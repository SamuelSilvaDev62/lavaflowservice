import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Resumo executivo do Consultor IA (plano Intelligence). */
export const getConsultorContexto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, assertFeature } = await import("@/lib/entitlements.server");
    const { buildConsultorContexto } = await import("@/lib/assistente.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (!["owner", "admin", "gerente"].includes(role)) {
      throw new Error("Sem permissão para acessar o Consultor IA.");
    }
    await assertFeature(ownerId, "ai_assistant");
    return { contexto: await buildConsultorContexto(ownerId) };
  });

/** Análises inteligentes usadas nos relatórios (plano Intelligence). */
export const getAnalisesInteligentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, assertFeature } = await import("@/lib/entitlements.server");
    const { buildConsultorContexto } = await import("@/lib/assistente.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (!["owner", "admin", "gerente"].includes(role)) {
      throw new Error("Sem permissão para acessar as análises inteligentes.");
    }
    await assertFeature(ownerId, "analises_inteligentes");
    const ctx = await buildConsultorContexto(ownerId);
    const destaques: Array<{ titulo: string; detalhe: string }> = [];
    if (ctx.clientesInativos60d > 0) {
      destaques.push({
        titulo: `${ctx.clientesInativos60d} clientes sem retorno há 60 dias`,
        detalhe: `Potencial de recuperação de aproximadamente R$ ${(ctx.clientesInativos60d * ctx.ticketMedio).toFixed(2)} com uma campanha de reativação.`,
      });
    }
    if (ctx.topServicos[0]) {
      destaques.push({
        titulo: `${ctx.topServicos[0].nome} é seu serviço mais rentável`,
        detalhe: `Responde por R$ ${ctx.topServicos[0].receita.toFixed(2)} nos ${ctx.periodo}. Vale divulgar como combo.`,
      });
    }
    if (ctx.ticketMedio > 0) {
      destaques.push({
        titulo: `Ticket médio de R$ ${ctx.ticketMedio.toFixed(2)}`,
        detalhe: "Um upsell simples (cera ou higienização interna) tende a elevar o ticket em 15% a 25%.",
      });
    }
    return { contexto: ctx, destaques };
  });
