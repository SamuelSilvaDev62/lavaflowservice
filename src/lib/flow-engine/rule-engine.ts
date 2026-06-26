import type { BusinessInsight, FlowModule, InsightSeverity } from "./types";

type RuleMetrics = {
  tenantId: string;
  inactiveClients: number;
  inactiveRevenuePotential: number;
  lowOccupancyDays: number;
  occupancyRate: number;
  currentRevenue: number;
  previousRevenue: number;
  averageTicket: number;
  rewardReadyClients: number;
  premiumServiceDropPct: number;
};

function insight(input: {
  tenantId: string;
  id: string;
  severity: InsightSeverity;
  module: FlowModule;
  title: string;
  description: string;
  metric?: string;
  value?: number;
  suggestedAction?: string;
  actionType?: string;
  actionPayload?: Record<string, any>;
}): BusinessInsight {
  return {
    ...input,
    createdAt: new Date().toISOString(),
  };
}

export function generateBusinessInsights(metrics: RuleMetrics): BusinessInsight[] {
  const items: BusinessInsight[] = [];
  const revenueDelta = metrics.previousRevenue > 0
    ? (metrics.currentRevenue - metrics.previousRevenue) / metrics.previousRevenue
    : 0;

  if (metrics.inactiveClients > 0) {
    items.push(insight({
      tenantId: metrics.tenantId,
      id: "clientes-inativos",
      severity: metrics.inactiveClients >= 15 ? "critical" : "opportunity",
      module: "clientes",
      title: `${metrics.inactiveClients} clientes inativos encontrados`,
      description: `Ha potencial estimado de ${Math.round(metrics.inactiveRevenuePotential)} em retorno se parte desses clientes voltar.`,
      metric: "inactive_clients",
      value: metrics.inactiveClients,
      suggestedAction: "Gerar campanha de recuperacao com mensagem personalizada.",
      actionType: "generate_inactive_clients_campaign",
      actionPayload: { days: 45 },
    }));
  }

  if (metrics.lowOccupancyDays > 0 || metrics.occupancyRate < 0.5) {
    items.push(insight({
      tenantId: metrics.tenantId,
      id: "agenda-baixa-ocupacao",
      severity: metrics.occupancyRate < 0.35 ? "warning" : "opportunity",
      module: "agenda",
      title: "Agenda com baixa ocupacao",
      description: `${metrics.lowOccupancyDays} dia(s) proximos estao abaixo da ocupacao ideal.`,
      metric: "occupancy_rate",
      value: metrics.occupancyRate,
      suggestedAction: "Criar campanha para preencher horarios disponiveis.",
      actionType: "generate_agenda_campaign",
      actionPayload: { windowDays: 7 },
    }));
  }

  if (revenueDelta <= -0.1) {
    items.push(insight({
      tenantId: metrics.tenantId,
      id: "queda-faturamento",
      severity: revenueDelta <= -0.25 ? "critical" : "warning",
      module: "financeiro",
      title: "Faturamento em queda",
      description: `Receita caiu ${Math.abs(Math.round(revenueDelta * 100))}% contra o periodo anterior.`,
      metric: "revenue_delta",
      value: revenueDelta,
      suggestedAction: "Gerar diagnostico de faturamento e plano de acao.",
      actionType: "generate_revenue_diagnosis",
      actionPayload: { period: "30d" },
    }));
  }

  if (metrics.rewardReadyClients > 0) {
    items.push(insight({
      tenantId: metrics.tenantId,
      id: "recompensas-disponiveis",
      severity: "opportunity",
      module: "marketing",
      title: `${metrics.rewardReadyClients} clientes podem resgatar recompensas`,
      description: "Clientes com pontos suficientes tendem a voltar quando recebem um convite claro.",
      metric: "reward_ready_clients",
      value: metrics.rewardReadyClients,
      suggestedAction: "Enviar campanha de fidelidade com link para recompensas.",
      actionType: "generate_loyalty_campaign",
      actionPayload: {},
    }));
  }

  if (metrics.premiumServiceDropPct <= -0.2) {
    items.push(insight({
      tenantId: metrics.tenantId,
      id: "servico-premium-queda",
      severity: "opportunity",
      module: "marketing",
      title: "Servico premium em queda",
      description: `Venda de servicos premium caiu ${Math.abs(Math.round(metrics.premiumServiceDropPct * 100))}% no periodo.`,
      metric: "premium_service_delta",
      value: metrics.premiumServiceDropPct,
      suggestedAction: "Criar campanha de upsell para clientes de servicos basicos.",
      actionType: "generate_upsell_campaign",
      actionPayload: {},
    }));
  }

  if (items.length === 0) {
    items.push(insight({
      tenantId: metrics.tenantId,
      id: "operacao-estavel",
      severity: "info",
      module: "operacao",
      title: "Operacao sem alertas criticos",
      description: "Os principais indicadores estao dentro de uma faixa saudavel para o periodo analisado.",
      metric: "health",
      value: 1,
      suggestedAction: "Gerar resumo diario para acompanhar oportunidades menores.",
      actionType: "generate_daily_summary",
      actionPayload: {},
    }));
  }

  return items;
}
