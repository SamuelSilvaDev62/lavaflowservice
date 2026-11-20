// Helpers de entitlement no SERVIDOR. Nunca importado pelo cliente.
import {
  getEntitlement,
  canUseFeature,
  isFreeFeature,
  requiredTierFor,
  type Entitlement,
  type FeatureKey,
} from "@/lib/plans";

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
  const { data, error } = await supabase
    .from("tenant_subscriptions")
    .select("plan, subscription_status, is_founders, stripe_price_id, current_period_end, trial_ends_at, cancel_at_period_end, stripe_customer_id, updated_at")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar o plano do estabelecimento.");

  return getEntitlement(
    data
      ? { ...data, has_customer: !!data.stripe_customer_id }
      : null,
  );
}

export class FeatureBlockedError extends Error {
  feature: FeatureKey;
  requiredTier: string;
  /** HTTP status usado por rotas que expõem o bloqueio (hardening: 403). */
  statusCode = 403;
  constructor(feature: FeatureKey) {
    super(`Recurso disponível no plano Growth (${feature}). Assine o Growth para continuar.`);
    this.name = "FeatureBlockedError";
    this.feature = feature;
    this.requiredTier = requiredTierFor(feature);
  }
}

/**
 * Bloqueio real no backend para recursos Growth.
 * - Features Free passam sempre (operação nunca é bloqueada por cobrança).
 * - Features Growth são fail closed: erro de leitura do entitlement bloqueia.
 */
export async function assertFeature(ownerId: string, feature: FeatureKey): Promise<Entitlement | null> {
  if (isFreeFeature(feature)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let entitlement: Entitlement;
  try {
    entitlement = await fetchEntitlement(supabaseAdmin, ownerId);
  } catch (err) {
    console.error("[entitlements] falha ao ler assinatura (fail closed em Growth)", err);
    throw new FeatureBlockedError(feature);
  }
  if (!canUseFeature(entitlement, feature)) throw new FeatureBlockedError(feature);
  return entitlement;
}
