import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES_GESTAO = new Set(["owner", "admin", "gerente"]);

function assertGestao(role: string) {
  if (!ROLES_GESTAO.has(role)) {
    throw new Error("Sem permissão para acessar o Recovery Engine.");
  }
}

/**
 * Painel único do Recovery Engine: oportunidades determinísticas + ROI atribuído.
 * Nenhum envio acontece aqui; a execução continua no fluxo rastreável de Campanhas.
 */
export const getRecoveryOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, assertFeature } = await import("@/lib/entitlements.server");
    const { buildRecoveryEngineData, buildRecoveryRoi } = await import("@/lib/recovery.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    assertGestao(role);
    await assertFeature(ownerId, "oportunidades");

    const [engine, roi] = await Promise.all([
      buildRecoveryEngineData(context.supabase, ownerId),
      buildRecoveryRoi(context.supabase, ownerId),
    ]);

    return { engine, roi };
  });

/**
 * Cria uma campanha Recovery a partir dos clientes mais prioritários do motor.
 * A campanha nasce ativa, mas os envios continuam manuais/confirmados em Campanhas,
 * preservando a atribuição de receita somente após envio realmente confirmado.
 */
export const criarCampanhaRecovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        limit: z.number().int().min(1).max(30).default(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveOwnerScope, assertFeature } = await import("@/lib/entitlements.server");
    const {
      buildRecoveryEngineData,
      logRecoveryRun,
      RECOVERY_ATTRIBUTION_DAYS,
    } = await import("@/lib/recovery.server");

    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    assertGestao(role);
    await assertFeature(ownerId, "campanhas");

    const engine = await buildRecoveryEngineData(context.supabase, ownerId);
    const selecionados = engine.candidatos.slice(0, data.limit);
    if (!selecionados.length) {
      throw new Error("Não há clientes elegíveis para recuperação neste momento.");
    }

    const agora = new Date();
    const dataLabel = agora.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
    const receitaPotencial = selecionados.reduce((s, c) => s + c.receitaPotencial, 0);
    const valorEsperado = selecionados.reduce((s, c) => s + c.valorEsperado, 0);

    const { data: campanha, error: campanhaError } = await context.supabase
      .from("campanhas")
      .insert({
        owner_id: ownerId,
        nome: `Recovery Engine — ${dataLabel}`,
        tipo: "inativos",
        canal: "whatsapp",
        status: "ativa",
        mensagem: engine.mensagemSugerida,
        metadata: {
          generated_by: "recovery_engine",
          engine_version: 1,
          candidatos: selecionados.length,
          impacto_estimado: Math.round(receitaPotencial * 100) / 100,
          valor_esperado: Math.round(valorEsperado * 100) / 100,
          taxa_conversao_usada: engine.resumo.taxaConversaoUsada,
          taxa_baseada_em_historico: engine.resumo.taxaBaseadaEmHistorico,
          attribution_window_days: RECOVERY_ATTRIBUTION_DAYS,
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
        generated_by: "recovery_engine",
        dias_inativo: c.diasSemRetornar,
        visitas: c.visitas,
        gasto_total: c.gastoTotal,
        ticket_medio: c.ticketMedio,
        intervalo_esperado_dias: c.intervaloEsperadoDias,
        atraso_dias: c.atrasoDias,
        score: c.score,
        prioridade: c.prioridade,
        confianca: c.confianca,
        receita_potencial: c.receitaPotencial,
        valor_esperado: c.valorEsperado,
        motivo: c.motivo,
      },
    }));

    const { error: alvosError } = await context.supabase.from("campanha_alvos").insert(rows as any);
    if (alvosError) {
      // Evita deixar campanha vazia se o segundo passo falhar.
      await context.supabase.from("campanhas").delete().eq("id", campanha.id).eq("owner_id", ownerId);
      throw alvosError;
    }

    await logRecoveryRun(context.supabase, {
      ownerId,
      userId: context.userId,
      campanhaId: campanha.id,
      candidatos: selecionados.length,
      receitaPotencial,
      valorEsperado,
      taxaConversao: engine.resumo.taxaConversaoUsada,
    });

    return {
      campanhaId: campanha.id,
      nome: campanha.nome,
      candidatos: selecionados.length,
      receitaPotencial: Math.round(receitaPotencial * 100) / 100,
      valorEsperado: Math.round(valorEsperado * 100) / 100,
    };
  });
