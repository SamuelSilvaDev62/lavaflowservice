// Growth Readiness + Growth Preview — 100% determinístico, sem IA, sem PII.
// Somente leitura. Nunca importado pelo cliente.

const DIA = 86_400_000;

export type GrowthPreview = {
  tier: "free" | "growth";
  growthActive: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  trialDiasRestantes: number | null;
  trialUsado: boolean;
  trialElegivel: boolean;
  isFounders: boolean;
  /** 0–100, determinístico. */
  readinessScore: number;
  growthReady: boolean;
  progresso: { osEntregues: number; clientes: number; diasAtivos: number; recorrentes: number };
  /** Agregados — nunca nomes/telefones/IDs. */
  oportunidades: {
    total: number;
    potencialEstimado: number;
    candidatosRetorno: number;
    candidatosAssinatura: number;
    categorias: Array<{ chave: string; label: string; quantidade: number; potencialEstimado: number }>;
  };
  ticketMedio: number;
  receitaInfluenciada: number;
  insight: string;
};

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function assertOk(label: string, error: any) {
  if (error) {
    console.error(`[growth-preview] falha na consulta ${label}`, error?.message ?? error);
    throw new Error("Não foi possível calcular o panorama de crescimento agora.");
  }
}

/**
 * Score 0–100:
 *  30 pts volume operacional (meta 20 OS entregues)
 *  20 pts base de clientes (meta 15)
 *  15 pts dias distintos com OS (meta 7)
 *  15 pts recorrência (meta 3 clientes com 2+ visitas)
 *  10 pts clientes inativos detectáveis (>= 45 dias)
 *  10 pts ao menos um sinal Growth (candidato a assinatura ou receita influenciada)
 * growthReady = score >= 60 E >= 10 OS entregues E >= 10 clientes.
 */
export async function buildGrowthPreview(
  supabase: any,
  ownerId: string,
  entitlement: {
    tier: "free" | "growth";
    growthActive: boolean;
    isTrial: boolean;
    trialEndsAt: string | null;
    trialUsado: boolean;
    isFounders: boolean;
    hasCustomer: boolean;
  },
): Promise<GrowthPreview> {
  const agora = Date.now();

  const [os, clientes, planos, influenciada] = await Promise.all([
    supabase
      .from("ordens_servico")
      .select("id, valor, status, cliente_id, created_at, entregue_em")
      .eq("owner_id", ownerId),
    supabase.from("clientes").select("id, created_at").eq("owner_id", ownerId),
    supabase
      .from("planos_assinatura")
      .select("valor_mensal, ativo")
      .eq("owner_id", ownerId)
      .eq("ativo", true)
      .order("valor_mensal", { ascending: true }),
    supabase.from("receita_influenciada").select("valor, created_at").eq("owner_id", ownerId),
  ]);

  assertOk("ordens_servico", os.error);
  assertOk("clientes", clientes.error);
  assertOk("planos_assinatura", planos.error);
  assertOk("receita_influenciada", influenciada.error);

  const ordens = (os.data ?? []) as Array<any>;
  const entregues = ordens.filter((o) => o.status === "entregue");
  const totalClientes = (clientes.data ?? []).length;

  const receitaEntregue = entregues.reduce((s, o) => s + Number(o.valor ?? 0), 0);
  const ticketMedio = entregues.length ? round2(receitaEntregue / entregues.length) : 0;

  const diasAtivos = new Set(
    entregues.map((o) => String(o.entregue_em ?? o.created_at ?? "").slice(0, 10)).filter(Boolean),
  ).size;

  // Visitas por cliente (sem expor IDs no retorno).
  const visitas = new Map<string, { qtd: number; ultima: number }>();
  for (const o of entregues) {
    if (!o.cliente_id) continue;
    const ts = new Date(o.entregue_em ?? o.created_at ?? 0).getTime();
    const atual = visitas.get(o.cliente_id) ?? { qtd: 0, ultima: 0 };
    visitas.set(o.cliente_id, { qtd: atual.qtd + 1, ultima: Math.max(atual.ultima, ts) });
  }
  const recorrentes = [...visitas.values()].filter((v) => v.qtd >= 2).length;
  const candidatosRetorno = [...visitas.values()].filter(
    (v) => v.ultima > 0 && agora - v.ultima >= 45 * DIA,
  ).length;
  const candidatosAssinatura = [...visitas.values()].filter((v) => v.qtd >= 3).length;

  const valorPlanoBase = Number((planos.data ?? [])[0]?.valor_mensal ?? 0);
  const receitaInfluenciada = round2(
    ((influenciada.data ?? []) as Array<any>).reduce((s, r) => s + Number(r.valor ?? 0), 0),
  );

  const potencialRetorno = round2(candidatosRetorno * ticketMedio);
  const potencialAssinatura = round2(candidatosAssinatura * valorPlanoBase);

  const categorias = [
    {
      chave: "retorno",
      label: "Clientes para reconquistar",
      quantidade: candidatosRetorno,
      potencialEstimado: potencialRetorno,
    },
    {
      chave: "assinatura",
      label: "Candidatos a plano recorrente",
      quantidade: candidatosAssinatura,
      potencialEstimado: potencialAssinatura,
    },
  ].filter((c) => c.quantidade > 0);

  const pts =
    Math.min(30, (entregues.length / 20) * 30) +
    Math.min(20, (totalClientes / 15) * 20) +
    Math.min(15, (diasAtivos / 7) * 15) +
    Math.min(15, (recorrentes / 3) * 15) +
    (candidatosRetorno > 0 ? 10 : 0) +
    (candidatosAssinatura > 0 || receitaInfluenciada > 0 ? 10 : 0);

  const readinessScore = Math.max(0, Math.min(100, Math.round(pts)));
  const growthReady = readinessScore >= 60 && entregues.length >= 10 && totalClientes >= 10;

  const trialDiasRestantes =
    entitlement.isTrial && entitlement.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(entitlement.trialEndsAt).getTime() - agora) / DIA))
      : null;

  const trialElegivel =
    entitlement.tier === "free" &&
    !entitlement.trialUsado &&
    !entitlement.isFounders &&
    growthReady;

  let insight = "O LavaFlow está aprendendo com a sua operação. Continue registrando OS e clientes.";
  if (potencialRetorno >= potencialAssinatura && candidatosRetorno > 0) {
    insight = `${candidatosRetorno} ${candidatosRetorno === 1 ? "cliente" : "clientes"} sem retornar há 45 dias ou mais — potencial estimado de retorno pelo seu ticket médio.`;
  } else if (candidatosAssinatura > 0) {
    insight = `${candidatosAssinatura} ${candidatosAssinatura === 1 ? "cliente recorrente" : "clientes recorrentes"} com perfil de plano mensal — receita mais previsível.`;
  } else if (entregues.length > 0) {
    insight = `${entregues.length} ${entregues.length === 1 ? "serviço entregue" : "serviços entregues"} registrados. Quanto mais histórico, melhores as oportunidades encontradas.`;
  }

  return {
    tier: entitlement.tier,
    growthActive: entitlement.growthActive,
    isTrial: entitlement.isTrial,
    trialEndsAt: entitlement.trialEndsAt,
    trialDiasRestantes,
    trialUsado: entitlement.trialUsado,
    trialElegivel,
    isFounders: entitlement.isFounders && entitlement.growthActive,
    readinessScore,
    growthReady,
    progresso: {
      osEntregues: entregues.length,
      clientes: totalClientes,
      diasAtivos,
      recorrentes,
    },
    oportunidades: {
      total: candidatosRetorno + candidatosAssinatura,
      potencialEstimado: round2(potencialRetorno + potencialAssinatura),
      candidatosRetorno,
      candidatosAssinatura,
      categorias,
    },
    ticketMedio,
    receitaInfluenciada,
    insight,
  };
}

/**
 * Analytics do funil Free -> Growth Ready -> trial -> pago.
 * Nenhuma tabela existente é semanticamente adequada (`public_page_events` é de
 * páginas públicas), então por ora é apenas log estruturado no servidor.
 * Persistência fica para migration futura — nenhum DDL nesta rodada.
 */
export type GrowthFunnelEvent =
  | "growth_ready"
  | "growth_locked_feature_view"
  | "growth_trial_started"
  | "growth_checkout_started";

export function trackGrowthEvent(
  event: GrowthFunnelEvent,
  ownerId: string,
  metadata: Record<string, string | number | boolean> = {},
) {
  // Sem PII: apenas owner (tenant) + agregados.
  console.info("[growth-funnel]", JSON.stringify({ event, ownerId, ...metadata }));
}
