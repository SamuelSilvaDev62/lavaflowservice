// Helpers de entitlement no SERVIDOR. Nunca importado pelo cliente.
import { getEntitlement, canUseFeature, requiredPlanFor, type Entitlement, type FeatureKey } from "@/lib/plans";

type TenantRole = "owner" | "admin" | "gerente" | "atendente" | "lavador" | "colaborador";

/** Resolve o tenant (owner_id) e o papel do usuário autenticado. */
export async function resolveOwnerScope(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("owner_id, role, created_at").eq("user_id", userId);
  const priority: Record<TenantRole, number> = {
    owner: 1, admin: 2, gerente: 3, atendente: 4, lavador: 5, colaborador: 5,
  };
  const rows = (data ?? []) as Array<{ owner_id: string; role: TenantRole; created_at?: string | null }>;
  const selfOwner = rows.find((r) => r.owner_id === userId && r.role === "owner");
  const sorted = rows.slice().sort((a, b) => {
    const byRole = (priority[a.role] ?? 99) - (priority[b.role] ?? 99);
    if (byRole) return byRole;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
  const current = selfOwner ?? sorted[0];
  return { ownerId: current?.owner_id ?? userId, role: (current?.role ?? "owner") as TenantRole };
}

export async function fetchEntitlement(supabase: any, ownerId: string): Promise<Entitlement> {
  const { data } = await supabase
    .from("tenant_subscriptions")
    .select("plan, subscription_status, is_founders, stripe_price_id, current_period_end, trial_ends_at, cancel_at_period_end, stripe_customer_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  return getEntitlement(
    data
      ? { ...data, has_customer: !!data.stripe_customer_id }
      : null,
  );
}

export class FeatureBlockedError extends Error {
  feature: FeatureKey;
  requiredPlan: string;
  constructor(feature: FeatureKey) {
    super(`Recurso não incluso no seu plano (${feature}). Faça upgrade para continuar.`);
    this.name = "FeatureBlockedError";
    this.feature = feature;
    this.requiredPlan = requiredPlanFor(feature);
  }
}

export class SubscriptionInactiveError extends Error {
  status: string;
  constructor(status: string) {
    super("Assinatura inativa. Reative seu plano em /planos para voltar a operar.");
    this.name = "SubscriptionInactiveError";
    this.status = status;
  }
}

/**
 * Bloqueio real no backend: chame em toda server function/ação de recurso premium.
 * Usa o admin client para não depender de RLS de leitura por papel.
 */
export async function assertFeature(ownerId: string, feature: FeatureKey): Promise<Entitlement> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const entitlement = await fetchEntitlement(supabaseAdmin, ownerId);
  if (!canUseFeature(entitlement, feature)) throw new FeatureBlockedError(feature);
  return entitlement;
}

/**
 * Exige trial válido ou assinatura em dia para qualquer ação OPERACIONAL.
 * Fail closed: falha na leitura do entitlement bloqueia a operação.
 */
export async function assertActiveSubscription(ownerId: string): Promise<Entitlement> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let entitlement: Entitlement;
  try {
    entitlement = await fetchEntitlement(supabaseAdmin, ownerId);
  } catch (err) {
    console.error("[entitlements] falha ao ler assinatura", err);
    throw new SubscriptionInactiveError("unknown");
  }
  if (!entitlement.ativo) throw new SubscriptionInactiveError(entitlement.status);
  return entitlement;
}

