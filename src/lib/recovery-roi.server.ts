import { GROWTH_PRICE_BRL } from "@/lib/plans";
import { RECOVERY_ATTRIBUTION_DAYS } from "@/lib/recovery.server";

export type RecoveryRoi = {
  periodoInicio: string;
  campanhasCriadas: number;
  execucoesDoMotor: number;
  contatosEnviados: number;
  clientesRecuperados: number;
  taxaConversao: number;
  receitaAtribuida: number;
  custoIaRegistrado: number;
  custoSobreReceita: number | null;
  multiploVsGrowth: number;
  custoMensageriaRastreado: boolean;
  atribuicao: {
    janelaDias: number;
    metodo: string;
  };
};

function round2(v: number) {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

function startOfCurrentMonthSaoPauloIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? String(now.getUTCFullYear());
  const month = parts.find((p) => p.type === "month")?.value ?? String(now.getUTCMonth() + 1).padStart(2, "0");
  // Usamos meio-dia UTC para evitar deslocar para o mês anterior em operações de comparação textual.
  return `${year}-${month}-01T12:00:00.000Z`;
}

function assertOk(label: string, error: any) {
  if (!error) return;
  console.error(`[recovery-roi] falha em ${label}`, error?.message ?? error);
  throw new Error("Não foi possível calcular o ROI do Recovery Engine agora.");
}

/**
 * ROI Ledger do Recovery Engine.
 * Conta apenas campanhas marcadas com metadata.generated_by = recovery_engine.
 * Receita atribuída continua vindo da trilha existente de receita_influenciada.
 */
export async function buildRecoveryRoi(
  supabase: any,
  ownerId: string,
): Promise<RecoveryRoi> {
  const periodoInicio = startOfCurrentMonthSaoPauloIso();

  const [campanhasRes, receitasRes, usageRes, tasksRes] = await Promise.all([
    supabase
      .from("campanhas")
      .select("id, tipo, metadata, created_at")
      .eq("owner_id", ownerId)
      .eq("tipo", "inativos")
      .limit(500),
    supabase
      .from("receita_influenciada")
      .select("id, cliente_id, valor, metadata, created_at")
      .eq("owner_id", ownerId)
      .eq("origem", "CAMPANHA")
      .gte("created_at", periodoInicio)
      .limit(1000),
    supabase
      .from("ai_usage_logs")
      .select("estimated_cost, created_at")
      .eq("tenant_id", ownerId)
      .eq("task_type", "recovery_engine")
      .gte("created_at", periodoInicio)
      .limit(1000),
    supabase
      .from("flow_tasks")
      .select("id, created_at")
      .eq("tenant_id", ownerId)
      .eq("task_type", "recovery_engine")
      .gte("created_at", periodoInicio)
      .limit(1000),
  ]);

  assertOk("campanhas", campanhasRes.error);
  assertOk("receita_influenciada", receitasRes.error);
  assertOk("ai_usage_logs", usageRes.error);
  assertOk("flow_tasks", tasksRes.error);

  const recoveryCampaigns = ((campanhasRes.data ?? []) as any[]).filter(
    (c) => c.metadata?.generated_by === "recovery_engine",
  );
  const campaignIds = recoveryCampaigns.map((c) => c.id);
  const campaignSet = new Set(campaignIds);

  const alvosRes = campaignIds.length
    ? await supabase
        .from("campanha_alvos")
        .select("id, campanha_id, cliente_id, status, sent_at, converted_at")
        .eq("owner_id", ownerId)
        .in("campanha_id", campaignIds)
        .limit(5000)
    : { data: [] as any[], error: null };
  assertOk("campanha_alvos", alvosRes.error);

  const alvos = (alvosRes.data ?? []) as any[];
  const enviados = alvos.filter((a) => a.sent_at && a.sent_at >= periodoInicio);
  const convertidos = alvos.filter((a) => a.converted_at && a.converted_at >= periodoInicio);
  const receitasRecovery = ((receitasRes.data ?? []) as any[]).filter((r) => {
    const campanhaId = r.metadata?.campanha_id;
    return campanhaId && campaignSet.has(campanhaId);
  });

  const receitaAtribuida = round2(
    receitasRecovery.reduce((sum, row) => sum + Number(row.valor ?? 0), 0),
  );
  const custoIaRegistrado = round2(
    ((usageRes.data ?? []) as any[]).reduce((sum, row) => sum + Number(row.estimated_cost ?? 0), 0),
  );
  const clientesRecuperados = new Set(
    convertidos.map((a) => a.cliente_id).filter(Boolean),
  ).size;
  const taxaConversao = enviados.length ? convertidos.length / enviados.length : 0;

  return {
    periodoInicio,
    campanhasCriadas: recoveryCampaigns.filter((c) => c.created_at >= periodoInicio).length,
    execucoesDoMotor: (tasksRes.data ?? []).length,
    contatosEnviados: enviados.length,
    clientesRecuperados,
    taxaConversao: round2(taxaConversao),
    receitaAtribuida,
    custoIaRegistrado,
    custoSobreReceita: receitaAtribuida > 0 ? round2(custoIaRegistrado / receitaAtribuida) : null,
    multiploVsGrowth: round2(receitaAtribuida / GROWTH_PRICE_BRL),
    custoMensageriaRastreado: false,
    atribuicao: {
      janelaDias: RECOVERY_ATTRIBUTION_DAYS,
      metodo: `OS entregue em até ${RECOVERY_ATTRIBUTION_DAYS} dias após um envio confirmado; cada OS recebe no máximo uma atribuição de campanha.`,
    },
  };
}
