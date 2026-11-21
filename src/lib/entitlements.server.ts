import { selectTenantMembership } from "@/lib/tenant-scope";
// Helpers de entitlement no SERVIDOR. Nunca importado pelo cliente.
import {
  getEntitlement,
  canUseFeature,
  isFreeFeature,
  requiredTierFor,
  type Entitlement,
  type FeatureKey,
} from "@/lib/plans";

import type { TenantMembership } from "@/lib/tenant-scope";

/** Resolve o tenant (owner_id) e o papel do usuário autenticado. */
export async function resolveOwnerScope(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("owner_id, role, created_at").eq("user_id", userId);
  if (error) throw new Error("Falha ao consultar os vínculos da empresa.");
  return selectTenantMembership(userId, (data ?? []) as TenantMembership[]);
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
