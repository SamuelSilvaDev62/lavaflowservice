// Configuração central de planos e features do LavaFlow.
// Regra: nunca comparar strings de plano espalhadas pelo código —
// sempre usar canUseFeature() / getEntitlement().

export type PlanId = "essencial" | "growth" | "intelligence";

export type FeatureKey =
  // Essencial (operação)
  | "clientes"
  | "agendamentos"
  | "ordens"
  | "fila"
  | "equipe"
  | "configuracoes"
  // Growth (relacionamento e crescimento)
  | "fidelidade"
  | "clientes_inativos"
  | "campanhas"
  | "whatsapp_automacoes"
  | "acompanhamento_cliente"
  | "assinaturas"
  | "oportunidades"
  | "relatorios_avancados"
  // Intelligence
  | "ai_assistant"
  | "analises_inteligentes"
  | "recomendacoes";

export const PLAN_ORDER: PlanId[] = ["essencial", "growth", "intelligence"];

const ESSENCIAL_FEATURES: FeatureKey[] = [
  "clientes",
  "agendamentos",
  "ordens",
  "fila",
  "equipe",
  "configuracoes",
];

const GROWTH_FEATURES: FeatureKey[] = [
  ...ESSENCIAL_FEATURES,
  "fidelidade",
  "clientes_inativos",
  "campanhas",
  "whatsapp_automacoes",
  "acompanhamento_cliente",
  "assinaturas",
  "oportunidades",
  "relatorios_avancados",
];

const INTELLIGENCE_FEATURES: FeatureKey[] = [
  ...GROWTH_FEATURES,
  "ai_assistant",
  "analises_inteligentes",
  "recomendacoes",
];

export const PLAN_FEATURES: Record<PlanId, FeatureKey[]> = {
  essencial: ESSENCIAL_FEATURES,
  growth: GROWTH_FEATURES,
  intelligence: INTELLIGENCE_FEATURES,
};

export type PlanDefinition = {
  id: PlanId;
  nome: string;
  precoMensal: number;
  recomendado?: boolean;
  resumo: string;
  destaques: string[];
  /** Nome da variável de ambiente com o Price ID da Stripe. */
  priceEnv: string;
};

export const PLANS: PlanDefinition[] = [
  {
    id: "essencial",
    nome: "Essencial",
    precoMensal: 99,
    resumo: "A operação completa do lava-rápido no dia a dia.",
    destaques: [
      "Clientes e veículos",
      "Agendamentos e agenda do dia",
      "Ordens de serviço e fila (Kanban)",
      "Equipe e comissões",
    ],
    priceEnv: "STRIPE_PRICE_ESSENCIAL",
  },
  {
    id: "growth",
    nome: "Growth",
    precoMensal: 179,
    recomendado: true,
    resumo: "Tudo do Essencial + relacionamento e crescimento.",
    destaques: [
      "Tudo do Essencial",
      "Fidelidade e recompensas",
      "Recuperação de clientes inativos",
      "Campanhas e automações de WhatsApp",
      "Assinaturas recorrentes de serviços",
      "Oportunidades e relatórios avançados",
    ],
    priceEnv: "STRIPE_PRICE_GROWTH",
  },
  {
    id: "intelligence",
    nome: "Intelligence",
    precoMensal: 279,
    resumo: "Tudo do Growth + inteligência e recomendações.",
    destaques: [
      "Tudo do Growth",
      "Assistente com IA",
      "Análises inteligentes",
      "Recomendações e automações inteligentes",
    ],
    priceEnv: "STRIPE_PRICE_INTELLIGENCE",
  },
];

/** Oferta especial (primeiros clientes). Não é exibida como 4º plano público. */
export const FOUNDERS_OFFER = {
  id: "founders" as const,
  nome: "Founders",
  precoMensal: 99,
  /** Acesso equivalente ao Intelligence enquanto ativo. */
  planoEquivalente: "intelligence" as PlanId,
  priceEnv: "STRIPE_PRICE_FOUNDERS",
  limiteClientes: 5,
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  clientes: "Clientes",
  agendamentos: "Agendamentos",
  ordens: "Ordens de serviço",
  fila: "Fila de serviços",
  equipe: "Equipe",
  configuracoes: "Configurações",
  fidelidade: "Programa de fidelidade",
  clientes_inativos: "Recuperação de clientes",
  campanhas: "Campanhas",
  whatsapp_automacoes: "Automações de WhatsApp",
  acompanhamento_cliente: "Acompanhamento do cliente",
  assinaturas: "Assinaturas recorrentes",
  oportunidades: "Oportunidades",
  relatorios_avancados: "Relatórios avançados",
  ai_assistant: "Assistente com IA",
  analises_inteligentes: "Análises inteligentes",
  recomendacoes: "Recomendações inteligentes",
};

/** Menor plano que inclui a feature (usado no CTA de upgrade). */
export function requiredPlanFor(feature: FeatureKey): PlanId {
  for (const plan of PLAN_ORDER) {
    if (PLAN_FEATURES[plan].includes(feature)) return plan;
  }
  return "intelligence";
}

export type SubscriptionRow = {
  plan: PlanId | null;
  subscription_status: string | null;
  is_founders: boolean | null;
  stripe_price_id?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  cancel_at_period_end?: boolean | null;
  has_customer?: boolean | null;
};

export type Entitlement = {
  /** Plano efetivo para liberação de features (null = sem acesso premium). */
  plan: PlanId | null;
  /** Plano assinado de fato (sem considerar trial/founders). */
  planoAssinado: PlanId | null;
  status: string;
  isFounders: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  /** Assinatura em dia (ou trial válido). */
  ativo: boolean;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
/** Tolerância antes de cortar acesso em falha de pagamento (dados nunca são apagados). */
const GRACE_STATUSES = new Set(["past_due", "unpaid"]);
const GRACE_DAYS = 7;

/**
 * Estado seguro por padrão: sem assinatura e sem trial válido => plan = null
 * (nenhuma feature premium liberada; operação essencial em trial).
 */
export function getEntitlement(row: SubscriptionRow | null | undefined): Entitlement {
  const status = row?.subscription_status ?? "none";
  const isFounders = !!row?.is_founders;
  const trialEndsAt = row?.trial_ends_at ?? null;
  const currentPeriodEnd = row?.current_period_end ?? null;
  const now = Date.now();

  const trialValido = status === "trialing" && !!trialEndsAt && new Date(trialEndsAt).getTime() > now;
  const dentroDaCarencia =
    GRACE_STATUSES.has(status) &&
    !!currentPeriodEnd &&
    new Date(currentPeriodEnd).getTime() + GRACE_DAYS * 86_400_000 > now;

  const assinaturaValida = (ACTIVE_STATUSES.has(status) && status !== "trialing") || trialValido || dentroDaCarencia;

  let plan: PlanId | null = null;
  if (assinaturaValida) {
    if (isFounders) plan = FOUNDERS_OFFER.planoEquivalente;
    else if (row?.plan) plan = row.plan;
    else if (trialValido) plan = "essencial"; // trial sem plano: apenas operação
  }

  return {
    plan,
    planoAssinado: row?.plan ?? null,
    status,
    isFounders,
    isTrial: trialValido,
    trialEndsAt,
    currentPeriodEnd,
    cancelAtPeriodEnd: !!row?.cancel_at_period_end,
    hasCustomer: !!row?.has_customer,
    ativo: assinaturaValida,
  };
}

export function canUseFeature(entitlement: Entitlement | null | undefined, feature: FeatureKey): boolean {
  const plan = entitlement?.plan;
  if (!plan) return false;
  return PLAN_FEATURES[plan].includes(feature);
}

export function planLabel(plan: PlanId | null, isFounders = false): string {
  if (isFounders) return "Founders";
  if (!plan) return "Sem plano";
  return PLANS.find((p) => p.id === plan)?.nome ?? plan;
}

export const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  trialing: "Em teste",
  past_due: "Pagamento pendente",
  unpaid: "Pagamento em atraso",
  canceled: "Cancelada",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  paused: "Pausada",
  none: "Sem assinatura",
};
