import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Panorama agregado de crescimento. Disponível para Free (é o motor de conversão)
 * e para Growth. Retorna SOMENTE agregados — nunca nomes, telefones ou IDs.
 */
export const getGrowthPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, fetchEntitlement } = await import("@/lib/entitlements.server");
    const { buildGrowthPreview, trackGrowthEvent } = await import("@/lib/growth.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (!["owner", "admin", "gerente"].includes(role)) {
      throw new Error("Sem permissão para ver o panorama de crescimento.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entitlement = await fetchEntitlement(supabaseAdmin, ownerId);
    const preview = await buildGrowthPreview(context.supabase, ownerId, entitlement);
    if (preview.growthReady && preview.tier === "free") {
      trackGrowthEvent("growth_ready", ownerId, { score: preview.readinessScore });
    }
    return preview;
  });

/**
 * Trial contextual do Growth: 7 dias, sem cartão, sem objeto Stripe.
 * Só owner/admin, só quando Growth Ready, uma única vez por tenant.
 */
export const ativarTrialGrowth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, fetchEntitlement } = await import("@/lib/entitlements.server");
    const { buildGrowthPreview, trackGrowthEvent } = await import("@/lib/growth.server");
    const { resolveUniqueLiveSubscription } = await import("@/lib/stripe.server");
    const { GROWTH_TRIAL_DAYS } = await import("@/lib/plans");

    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Apenas o proprietário ou um administrador pode ativar o teste do Growth.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entitlement = await fetchEntitlement(supabaseAdmin, ownerId);

    if (entitlement.isFounders && entitlement.growthActive) {
      throw new Error("Sua conta Founders já tem acesso completo ao Growth.");
    }
    if (entitlement.tier === "growth") {
      throw new Error("O Growth já está ativo nesta conta.");
    }
    if (entitlement.trialUsado) {
      throw new Error("O teste gratuito do Growth já foi usado nesta conta. Assine o Growth para continuar.");
    }

    const { data: sub } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, subscription_status")
      .eq("owner_id", ownerId)
      .maybeSingle();

    // Anti-duplicação preservada: nunca ativar trial sobre assinatura viva.
    if (sub?.stripe_customer_id) {
      const viva = await resolveUniqueLiveSubscription(sub.stripe_customer_id, ownerId);
      if (viva) throw new Error("Já existe uma assinatura ativa nesta conta. Use “Gerenciar assinatura”.");
    }

    const preview = await buildGrowthPreview(context.supabase, ownerId, entitlement);
    if (!preview.growthReady) {
      throw new Error(
        "Seu LavaFlow ainda está aprendendo com a operação. O teste do Growth libera quando houver histórico suficiente — ou assine o Growth agora.",
      );
    }

    const trialEndsAt = new Date(Date.now() + GROWTH_TRIAL_DAYS * 86_400_000).toISOString();
    const { error } = await supabaseAdmin
      .from("tenant_subscriptions")
      .upsert(
        {
          owner_id: ownerId,
          plan: "growth",
          subscription_status: "trialing",
          trial_ends_at: trialEndsAt,
        },
        { onConflict: "owner_id" },
      );
    if (error) {
      console.error("[growth] falha ao ativar trial", error.message);
      throw new Error("Não foi possível ativar o teste agora. Tente novamente em instantes.");
    }

    trackGrowthEvent("growth_trial_started", ownerId, { score: preview.readinessScore });
    return { trialEndsAt, dias: GROWTH_TRIAL_DAYS };
  });
