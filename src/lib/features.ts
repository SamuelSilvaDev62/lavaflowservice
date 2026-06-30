// Feature flags do MVP v0.1 — define o que está ligado no modo enxuto.
// Nada é removido: apenas oculto. Para reativar tudo, basta sair do modo MVP
// (botão no rodapé da sidebar ou VITE_MVP_MODE=false).
import { isMvpMode } from "./mvp-mode";

export type FeatureKey =
  | "clientes"
  | "agendamento"
  | "ordem_servico"
  | "kanban"
  | "whatsapp"
  | "fidelidade"
  | "assinaturas"
  | "campanhas"
  | "financeiro_avancado"
  | "relatorios_avancados"
  | "assistente_completo";

const MVP_FEATURES: Record<FeatureKey, boolean> = {
  clientes: true,
  agendamento: true,
  ordem_servico: true,
  kanban: true,
  whatsapp: true,
  fidelidade: false,
  assinaturas: false,
  campanhas: false,
  financeiro_avancado: false,
  relatorios_avancados: false,
  assistente_completo: false,
};

const FULL_FEATURES: Record<FeatureKey, boolean> = {
  clientes: true,
  agendamento: true,
  ordem_servico: true,
  kanban: true,
  whatsapp: true,
  fidelidade: true,
  assinaturas: true,
  campanhas: true,
  financeiro_avancado: true,
  relatorios_avancados: true,
  assistente_completo: true,
};

export function getFeatures(): Record<FeatureKey, boolean> {
  return isMvpMode() ? MVP_FEATURES : FULL_FEATURES;
}

export function hasFeature(key: FeatureKey): boolean {
  return getFeatures()[key];
}
