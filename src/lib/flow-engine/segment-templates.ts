import type { SegmentTemplate } from "./types";

export const segmentTemplates: Record<string, SegmentTemplate> = {
  lava_rapido: {
    labels: {
      serviceOrder: "Ordem de Servico",
      worker: "Lavador",
      asset: "Veiculo",
      workflow: "Fila de lavagem",
    },
    defaultStages: ["Aguardando", "Em lavagem", "Finalizacao", "Pronto", "Entregue"],
    defaultInsights: [
      "clientes_inativos",
      "agenda_baixa_ocupacao",
      "ticket_medio_baixo",
      "servico_premium_em_queda",
      "recompensa_disponivel",
    ],
  },
};

export function getSegmentTemplate(segment?: string | null) {
  return segmentTemplates[segment ?? "lava_rapido"] ?? segmentTemplates.lava_rapido;
}
