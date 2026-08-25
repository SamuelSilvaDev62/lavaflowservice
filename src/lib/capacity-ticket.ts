export const CAPACITY_TICKET_WINDOW_DAYS = 30;

export type CapacityTicketSource = "delivered_30d" | "active_services" | "fallback";

export type CapacityTicketResult = {
  value: number;
  source: CapacityTicketSource;
  sampleSize: number;
  windowDays: number;
};

function round2(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/**
 * Regra canônica para valorar capacidade ociosa no LavaFlow Intelligence.
 *
 * Ordem de confiança:
 * 1) ticket médio das OS entregues nos últimos 30 dias;
 * 2) média de preço dos serviços ativos;
 * 3) fallback conservador de R$ 50.
 *
 * O Dashboard Operacional já usa esta mesma regra. Morning Brief e Agenda Fill
 * devem consumir este helper para que o mesmo espaço livre nunca receba valores
 * diferentes em superfícies diferentes do produto.
 */
export function calculateCapacityTicket(
  deliveredRows: Array<{ valor?: number | string | null }> | null | undefined,
  activeServices: Array<{ preco_padrao?: number | string | null }> | null | undefined,
  fallback = 50,
): CapacityTicketResult {
  const entregues = deliveredRows ?? [];
  if (entregues.length > 0) {
    const total = entregues.reduce((sum, row) => sum + Number(row.valor ?? 0), 0);
    return {
      value: round2(total / entregues.length),
      source: "delivered_30d",
      sampleSize: entregues.length,
      windowDays: CAPACITY_TICKET_WINDOW_DAYS,
    };
  }

  const precos = (activeServices ?? [])
    .map((row) => Number(row.preco_padrao ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (precos.length > 0) {
    return {
      value: round2(precos.reduce((sum, value) => sum + value, 0) / precos.length),
      source: "active_services",
      sampleSize: precos.length,
      windowDays: CAPACITY_TICKET_WINDOW_DAYS,
    };
  }

  return {
    value: round2(fallback),
    source: "fallback",
    sampleSize: 0,
    windowDays: CAPACITY_TICKET_WINDOW_DAYS,
  };
}
