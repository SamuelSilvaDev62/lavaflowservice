import type { FlowTaskDecision, FlowTaskRequest } from "./types";

const SQL_TASKS = new Set([
  "inactive_clients_metrics",
  "revenue_metrics",
  "daily_metrics",
  "agenda_occupancy",
  "ai_usage_summary",
]);

const RULE_TASKS = new Set([
  "generate_business_insights",
  "agenda_low_occupancy_insight",
  "loyalty_redemption_insight",
  "upsell_basic_to_premium",
]);

const CACHEABLE_TASKS = new Set([
  "generate_inactive_clients_campaign",
  "generate_revenue_diagnosis",
  "generate_daily_summary",
]);

const CREATIVE_TASKS = new Set([
  "generate_inactive_clients_campaign",
  "generate_agenda_campaign",
  "generate_upsell_campaign",
]);

const ANALYTICAL_TASKS = new Set([
  "generate_revenue_diagnosis",
  "generate_daily_summary",
]);

const MODULE_PERMISSIONS: Record<string, string[]> = {
  marketing: ["ai.view_insights", "ai.execute_marketing"],
  financeiro: ["ai.view_insights", "ai.execute_financial"],
  operacao: ["ai.view_insights", "ai.execute_operations"],
  clientes: ["ai.view_insights", "ai.execute_marketing"],
  agenda: ["ai.view_insights", "ai.execute_operations"],
  relatorios: ["ai.view_insights", "ai.execute_tasks"],
  assistente: ["ai.view_insights", "ai.execute_tasks"],
};

export function decideFlowTask(request: FlowTaskRequest): FlowTaskDecision {
  const requiredPermissions = MODULE_PERMISSIONS[request.module] ?? ["ai.execute_tasks"];

  if (!request.tenantId || !request.userId) {
    return {
      executionMode: "rule",
      reason: "Solicitacao sem tenant ou usuario validos.",
      canExecute: false,
      requiredPermissions,
    };
  }

  if (SQL_TASKS.has(request.taskType)) {
    return {
      executionMode: "sql",
      reason: "Metricas deterministicas devem ser calculadas por SQL/codigo.",
      estimatedCost: 0,
      canExecute: true,
      requiredPermissions,
    };
  }

  if (RULE_TASKS.has(request.taskType)) {
    return {
      executionMode: "rule",
      reason: "Insight derivado de regra de negocio local.",
      estimatedCost: 0,
      canExecute: true,
      requiredPermissions,
    };
  }

  if (CACHEABLE_TASKS.has(request.taskType)) {
    return {
      executionMode: "hybrid",
      reason: "Usa dados resumidos e cache antes de acionar inteligencia externa.",
      estimatedCost: request.priority === "high" ? 0.02 : 0.01,
      canExecute: true,
      requiredPermissions,
    };
  }

  if (CREATIVE_TASKS.has(request.taskType) || ANALYTICAL_TASKS.has(request.taskType)) {
    return {
      executionMode: "opensquad",
      reason: "Tarefa exige interpretacao, escrita ou diagnostico.",
      estimatedCost: 0.02,
      canExecute: true,
      requiredPermissions,
    };
  }

  return {
    executionMode: "rule",
    reason: "Tarefa desconhecida mantida em modo seguro ate ser mapeada.",
    estimatedCost: 0,
    canExecute: false,
    requiredPermissions,
  };
}
