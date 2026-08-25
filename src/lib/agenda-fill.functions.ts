import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES_GESTAO = new Set(["owner", "admin", "gerente"]);

function assertGestao(role: string) {
  if (!ROLES_GESTAO.has(role)) throw new Error("Sem permissão para acessar o Agenda Fill.");
}

export const getAgendaFillOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, assertFeature } = await import("@/lib/entitlements.server");
    const { buildAgendaFillData } = await import("@/lib/agenda-fill.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    assertGestao(role);
    await assertFeature(ownerId, "oportunidades");
    return buildAgendaFillData(context.supabase, ownerId);
  });

export const criarCampanhaAgendaFill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(30).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveOwnerScope, assertFeature } = await import("@/lib/entitlements.server");
    const { buildAgendaFillData, AGENDA_FILL_ATTRIBUTION_DAYS } = await import("@/lib/agenda-fill.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    assertGestao(role);
    await assertFeature(ownerId, "campanhas");

    const engine = await buildAgendaFillData(context.supabase, ownerId);
    if (!engine.oportunidade.data || engine.oportunidade.horariosLivres <= 0) {
      throw new Error("Não há capacidade ociosa relevante nos próximos dias.");
    }

    const limite = data.limit ?? engine.resumo.contatosRecomendados;
    const selecionados = engine.candidatos.slice(0, Math.min(limite, engine.resumo.contatosRecomendados || limite));
    if (!selecionados.length) {
      throw new Error("Há espaço na agenda, mas ainda não há clientes com timing confiável para abordar agora.");
    }

    const receitaPotencial = selecionados.reduce((s, c) => s + c.receitaPotencial, 0);
    const valorEsperado = selecionados.reduce((s, c) => s + c.valorEsperado, 0);
    const dataLabel = engine.oportunidade.dataLabel ?? engine.oportunidade.data;

    const { data: campanha, error: campanhaError } = await context.supabase
      .from("campanhas")
      .insert({
        owner_id: ownerId,
        nome: `Agenda Fill — ${dataLabel}`,
        tipo: "baixa_ocupacao",
        canal: "whatsapp",
        status: "ativa",
        mensagem: engine.mensagemSugerida,
        metadata: {
          generated_by: "agenda_fill",
          engine_version: 1,
          target_date: engine.oportunidade.data,
          target_date_label: dataLabel,
          slots_livres: engine.oportunidade.horariosLivres,
          capacidade_restante: engine.oportunidade.capacidadeRestante,
          ocupacao: engine.oportunidade.ocupacao,
          potencial_capacidade: engine.oportunidade.potencialCapacidade,
          candidatos: selecionados.length,
          impacto_estimado: Math.round(receitaPotencial * 100) / 100,
          valor_esperado: Math.round(valorEsperado * 100) / 100,
          taxa_conversao_usada: engine.resumo.taxaConversaoUsada,
          taxa_baseada_em_historico: engine.resumo.taxaBaseadaEmHistorico,
          attribution_window_days: AGENDA_FILL_ATTRIBUTION_DAYS,
          contexto_usado: engine.contextoUsado,
        },
      } as any)
      .select("id, nome")
      .single();

    if (campanhaError) throw campanhaError;

    const rows = selecionados.map((c) => ({
      owner_id: ownerId,
      campanha_id: campanha.id,
      cliente_id: c.clienteId,
      nome: c.nome,
      telefone: c.telefone,
      status: "pendente",
      metadata: {
        generated_by: "agenda_fill",
        target_date: engine.oportunidade.data,
        visitas: c.visitas,
        ultima_visita: c.ultimaVisita,
        intervalo_esperado_dias: c.intervaloEsperadoDias,
        dias_para_janela: c.diasParaJanela,
        ticket_medio: c.ticketMedio,
        score: c.score,
        confianca: c.confianca,
        receita_potencial: c.receitaPotencial,
        valor_esperado: c.valorEsperado,
        motivo: c.motivo,
      },
    }));

    const { error: alvosError } = await context.supabase.from("campanha_alvos").insert(rows as any);
    if (alvosError) {
      await context.supabase.from("campanhas").delete().eq("id", campanha.id).eq("owner_id", ownerId);
      throw alvosError;
    }

    return {
      campanhaId: campanha.id,
      nome: campanha.nome,
      candidatos: selecionados.length,
      dataAlvo: engine.oportunidade.data,
      horariosLivres: engine.oportunidade.horariosLivres,
      potencialCapacidade: engine.oportunidade.potencialCapacidade,
      receitaPotencial: Math.round(receitaPotencial * 100) / 100,
      valorEsperado: Math.round(valorEsperado * 100) / 100,
    };
  });
