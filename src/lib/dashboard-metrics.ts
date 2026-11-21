/** Central do Dia: pure, tenant-agnostic display calculations. */
export type OperationStage = "aguardando" | "em_lavagem" | "finalizacao" | "pronto";

export function countOperationStages(rows: ReadonlyArray<{ status?: string | null }>) {
  const counts = { aguardando: 0, em_lavagem: 0, finalizacao: 0, pronto: 0 };
  for (const row of rows) {
    if (row.status && Object.prototype.hasOwnProperty.call(counts, row.status)) {
      counts[row.status as OperationStage] += 1;
    }
  }
  return counts;
}

/** Appointment prices only: OS may represent the SAME work and must not be added again. */
export function appointmentForecast(
  rows: ReadonlyArray<{ status?: string | null; servicos?: { preco_padrao?: number | null } | null; taxa_leva_traz?: number | null }>
) {
  const inactive = new Set(["concluido", "cancelado", "nao_compareceu"]);
  return Math.round(rows.filter(row => !inactive.has(row.status ?? ""))
    .reduce((total, row) => total + Math.max(0, Number(row.servicos?.preco_padrao) || 0) +
      Math.max(0, Number(row.taxa_leva_traz) || 0), 0) * 100) / 100;
}
