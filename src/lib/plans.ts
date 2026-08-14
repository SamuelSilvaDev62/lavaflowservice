// Configuração central da camada comercial do LavaFlow.
//
// TESE: "Free organiza. Growth encontra oportunidades."
// Público existem apenas dois tiers: `free` (R$ 0, para sempre) e `growth` (R$ 99/mês).
// Founders é uma condição especial grandfathered (acesso Growth completo + badge),
// NUNCA um terceiro card público.
//
// O enum do banco (`app_plan`) continua `essencial | growth | intelligence` — não
// alteramos schema. Assinaturas legadas Essencial/Intelligence pagas são tratadas
// como "Growth compatibility": nunca reduzimos acesso de quem já paga.

/** Plano legado armazenado em `tenant_subscriptions.plan` (enum do banco). */
export type PlanId = "essencial" | "growth" | "intelligence";

/** Tier comercial efetivo exposto ao produto. */
export type Tier = "free" | "growth";

export type FeatureKey =
  // FREE — operação completa do lava-rápido
  | "clientes"
  | "agendamentos"
  | "ordens"
  | "fila"
  | "equipe"
  | "configuracoes"
  // GROWTH — transformar dados em ações de crescimento
  | "fidelidade"
  | "clientes_inativos"
  | "campanhas"
  | "whatsapp_automacoes"
  | "acompanhamento_cliente"
  | "assinaturas"
  | "oportunidades"
  | "relatorios_avancados"
  | "receita_influenciada"
  | "growth_engine"
  | "ai_assistant"
  | "analises_inteligentes"
  | "recomendacoes";

/** Operação núcleo: sempre liberada, inclusive sem nenhuma assinatura. */
export const FREE_FEATURES: FeatureKey[] = [
  "clientes",
  "agendamentos",
  "ordens",
  "fila",
  "equipe",
  "configuracoes",
];

/** Tudo do Free + inteligência comercial. */
export const GROWTH_FEATURES: FeatureKey[] = [
  ...FREE_FEATURES,
  "fidelidade",
  "clientes_inativos",
  "campanhas",
  "whatsapp_automacoes",
  "acompanhamento_cliente",
  "assinaturas",
  "oportunidades",
  "relatorios_avancados",
  "receita_influenciada",
  "growth_engine",
  "ai_assistant",
  "analises_inteligentes",
  "recomendacoes",
];

export const TIER_FEATURES: Record<Tier, FeatureKey[]> = {
  free: FREE_FEATURES,
  growth: GROWTH_FEATURES,
};

export function isFreeFeature(feature: FeatureKey): boolean {
  return FREE_FEATURES.includes(feature);
}

export type TierDefinition = {
  id: Tier;
  nome: string;
  precoMensal: number;
  resumo: string;
  destaques: string[];
  recomendado?: boolean;
  /** Nome da variável de ambiente com o Price ID da Stripe (só o pago). */
  priceEnv?: string;
};

export const GROWTH_PRICE_BRL = 99;
/** Valor esperado do Price da Stripe em centavos (validado antes do Checkout). */
export const GROWTH_PRICE_CENTS = 9900;

export const TIERS: TierDefinition[] = [
  {
    id: "free",
    nome: "LavaFlow Free",
    precoMensal: 0,
    resumo: "Para organizar e operar seu lava-rápido.",
    destaques: [
      "Clientes e veículos",
      "Serviços e agenda",
      "Ordens de serviço e fila (Kanban)",
      "Equipe e configurações",
      "Painel operacional do dia",
      "Grátis para sempre · sem cartão",
    ],
  },
  {
    id: "growth",
    nome: "LavaFlow Growth",
    precoMensal: GROWTH_PRICE_BRL,
    recomendado: true,
    resumo: "Para transformar seus dados em ações de crescimento.",
    destaques: [
      "Tudo do Free",
      "Oportunidades do seu negócio",
      "Recuperação de clientes inativos",
      "Campanhas e mensagens de WhatsApp",
      "Programa de fidelidade",
      "Assinaturas de clientes",
      "Consultor IA e análises inteligentes",
      "Relatórios avançados e Receita Influenciada",
    ],
    priceEnv: "STRIPE_PRICE_GROWTH",
  },
];

/** Oferta especial grandfathered. Não é card público. */
export const FOUNDERS_OFFER = {
  id: "founders" as const,
  nome: "Founders",
  precoMensal: 99,
  priceEnv: "STRIPE_PRICE_FOUNDERS",
};

/** Dias do trial contextual do Growth (nunca automático no cadastro). */
export const GROWTH_TRIAL_DAYS = 7;

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
  whatsapp_automacoes: "Comunicação via WhatsApp",
  acompanhamento_cliente: "Acompanhamento do cliente",
  assinaturas: "Assinaturas recorrentes",
  oportunidades: "Oportunidades",
  relatorios_avancados: "Relatórios avançados",
  receita_influenciada: "Receita Influenciada",
  growth_engine: "Growth Engine",
  ai_assistant: "Consultor IA",
  analises_inteligentes: "Análises inteligentes",
  recomendacoes: "Recomendações inteligentes",
};

/** Tier mínimo que inclui a feature (usado no paywall). */
export function requiredTierFor(feature: FeatureKey): Tier {
  return isFreeFeature(feature) ? "free" : "growth";
}

export type SubscriptionRow = {
  plan: PlanId | null;
  subscription_status: string | null;
  is_founders: boolean | null;
  stripe_price_id?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  /** Marcador do trial contextual (sem schema novo): quando a row foi gravada. */
  updated_at?: string | null;
  cancel_at_period_end?: boolean | null;
  has_customer?: boolean | null;
};

export type Entitlement = {
  /** Tier comercial efetivo: só isso decide liberação de features. */
  tier: Tier;
  /** Growth liberado (assinatura paga, trial válido, carência ou Founders). */
  growthActive: boolean;
  /** Growth liberado por assinatura legada Essencial/Intelligence paga. */
  growthCompat: boolean;
  /** Plano legado armazenado (diagnóstico/compatibilidade). */
  planoAssinado: PlanId | null;
  status: string;
  isFounders: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  /** Trial contextual já consumido (trial_ends_at existente, mesmo passado). */
  trialUsado: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
};

const GRACE_STATUSES = new Set(["past_due", "unpaid"]);
const GRACE_DAYS = 7;
/** Tolerância técnica na janela do trial contextual (relógio/latência). */
const TRIAL_WINDOW_TOLERANCE_MS = 10 * 60_000;

/**
 * Mapeamento de compatibilidade (sem migration):
 * - sem row / canceled / incomplete_expired / none  => free
 * - trialing + plan growth + trial_ends_at futuro + janela <= 7d => growth (trial contextual)
 * - trialing legado (essencial/intelligence/null)   => free
 * - trial growth de 14 dias (histórico de teste)    => free (trialUsado = true)
 * - trial growth expirado                           => free
 * - active/past_due/unpaid exigem `plan` não nulo   => row malformada cai para free
 * - active (qualquer plano legado)                  => growth (compat quando não-growth)
 * - Founders ativo                                  => growth + badge
 * - past_due/unpaid dentro da carência              => growth; fora => free
 */
export function getEntitlement(row: SubscriptionRow | null | undefined): Entitlement {
  const status = row?.subscription_status ?? "none";
  const isFounders = !!row?.is_founders;
  const planoAssinado = row?.plan ?? null;
  const trialEndsAt = row?.trial_ends_at ?? null;
  const currentPeriodEnd = row?.current_period_end ?? null;
  const now = Date.now();

  // Janela coerente com o trial contextual de 7 dias: distingue o trial novo do
  // trial histórico de 14 dias sem precisar de coluna nova.
  const trialWindowMs =
    trialEndsAt && row?.updated_at
      ? new Date(trialEndsAt).getTime() - new Date(row.updated_at).getTime()
      : null;
  const janelaContextual =
    trialWindowMs !== null &&
    trialWindowMs > 0 &&
    trialWindowMs <= GROWTH_TRIAL_DAYS * 86_400_000 + TRIAL_WINDOW_TOLERANCE_MS;

  const trialGrowthValido =
    status === "trialing" &&
    planoAssinado === "growth" &&
    !!trialEndsAt &&
    new Date(trialEndsAt).getTime() > now &&
    janelaContextual;

  const pagoAtivo = status === "active" && planoAssinado !== null;
  const dentroDaCarencia =
    GRACE_STATUSES.has(status) &&
    planoAssinado !== null &&
    !!currentPeriodEnd &&
    new Date(currentPeriodEnd).getTime() + GRACE_DAYS * 86_400_000 > now;

  const growthActive = pagoAtivo || trialGrowthValido || dentroDaCarencia;
  const growthCompat =
    growthActive && !isFounders && !trialGrowthValido && planoAssinado !== "growth";

  return {
    tier: growthActive ? "growth" : "free",
    growthActive,
    growthCompat,
    planoAssinado,
    status,
    isFounders,
    isTrial: trialGrowthValido,
    trialEndsAt,
    trialUsado: !!trialEndsAt,
    currentPeriodEnd,
    cancelAtPeriodEnd: !!row?.cancel_at_period_end,
    hasCustomer: !!row?.has_customer,
  };
}

/**
 * Free nunca é bloqueado. Growth exige tier growth.
 * Entitlement ausente/indefinido (ex.: falha de leitura) => apenas Free.
 */
export function canUseFeature(
  entitlement: Entitlement | null | undefined,
  feature: FeatureKey,
): boolean {
  if (isFreeFeature(feature)) return true;
  return entitlement?.tier === "growth";
}

export function tierLabel(entitlement: Entitlement | null | undefined): string {
  if (!entitlement) return "Free";
  if (entitlement.isFounders && entitlement.growthActive) return "Founders";
  if (entitlement.tier === "growth") return entitlement.isTrial ? "Growth (teste)" : "Growth";
  return "Free";
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
  none: "Plano Free",
};

/** Status terminais na Stripe: a assinatura não pode mais ser reaproveitada. */
export const TERMINAL_STRIPE_STATUSES = new Set(["canceled", "incomplete_expired", "none"]);

/** Já existe assinatura Stripe gerenciável (cartão/faturas/cancelamento no portal)? */
export function hasManageableStripeSubscription(
  row: { stripe_subscription_id?: string | null; subscription_status?: string | null } | null | undefined,
): boolean {
  if (!row?.stripe_subscription_id) return false;
  return !TERMINAL_STRIPE_STATUSES.has(String(row.subscription_status ?? "none"));
}
