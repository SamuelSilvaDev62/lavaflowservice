/** Canonical forward-only stages for a work order. All UI labels may differ. */
export const WORK_ORDER_STAGES = [
  "aguardando",
  "em_lavagem",
  "finalizacao",
  "pronto",
  "entregue",
] as const;
export type WorkOrderStage = (typeof WORK_ORDER_STAGES)[number];

/** Duplicate requests are idempotent; rewinding or reopening a delivered OS is forbidden. */
export function canAdvanceWorkOrder(current: string, next: string): boolean {
  const before = WORK_ORDER_STAGES.indexOf(current as WorkOrderStage);
  const after = WORK_ORDER_STAGES.indexOf(next as WorkOrderStage);
  return before >= 0 && after >= 0 && after >= before;
}
