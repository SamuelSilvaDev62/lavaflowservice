import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Plano/assinatura do tenant atual (usado pela UI e pelos gates). */
export const getMeuPlano = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, fetchEntitlement } = await import("@/lib/entitlements.server");
    const { isStripeConfigured } = await import("@/lib/stripe.server");
    const { hasManageableStripeSubscription } = await import("@/lib/plans");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entitlement = await fetchEntitlement(supabaseAdmin, ownerId);
    const { data: sub } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("stripe_subscription_id, subscription_status")
      .eq("owner_id", ownerId)
      .maybeSingle();
    return {
      entitlement,
      role,
      stripeConfigurado: isStripeConfigured(),
      assinaturaGerenciavel: hasManageableStripeSubscription(sub),
    };
  });

/**
 * Checkout do ÚNICO plano pago público: Growth R$ 99/mês.
 * - Valida o Price na Stripe (read-only) antes de abrir sessão: nunca cobra valor errado.
 * - Anti-duplicação: qualquer assinatura viva impede novo Checkout; >1 bloqueia.
 */
export const criarCheckoutAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { stripeRequest, resolveUniqueLiveSubscription, assertGrowthPriceValido } = await import(
      "@/lib/stripe.server"
    );
    const { appOrigin, requireGestao } = await import("@/lib/billing.server");
    const { trackGrowthEvent } = await import("@/lib/growth.server");
    const ownerId = await requireGestao(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, subscription_status, is_founders")
      .eq("owner_id", ownerId)
      .maybeSingle();

    const origin = appOrigin();

    // Verdade na Stripe: se já existe assinatura viva, nunca criar outra.
    if (sub?.stripe_customer_id) {
      const existente = await resolveUniqueLiveSubscription(sub.stripe_customer_id, ownerId);
      if (existente) {
        if (sub.stripe_subscription_id && sub.stripe_subscription_id !== existente.id) {
          console.warn("[billing] banco divergente da Stripe", {
            ownerId,
            local: sub.stripe_subscription_id,
            stripe: existente.id,
          });
        }
        return {
          modo: "gerenciar" as const,
          url: null,
          motivo:
            "Já existe uma assinatura ativa para este estabelecimento. Use “Gerenciar assinatura” para cartão, faturas ou cancelamento.",
        };
      }
    }

    // Founders mantém o Price histórico; todos os demais assinam o Growth R$ 99.
    const founders = !!sub?.is_founders;
    const priceId = founders
      ? process.env["STRIPE_PRICE_FOUNDERS"]
      : await assertGrowthPriceValido();
    if (!priceId) throw new Error("Preço da Stripe não configurado para esta conta.");

    let customerId = sub?.stripe_customer_id ?? null;
    if (!customerId) {
      const { data: emp } = await supabaseAdmin
        .from("empresa")
        .select("nome_fantasia, email")
        .eq("owner_id", ownerId)
        .maybeSingle();
      const customer = await stripeRequest<{ id: string }>("/customers", {
        body: {
          name: emp?.nome_fantasia ?? undefined,
          email: emp?.email ?? undefined,
          metadata: { owner_id: ownerId },
        },
        idempotencyKey: `customer-${ownerId}`,
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("tenant_subscriptions")
        .upsert({ owner_id: ownerId, stripe_customer_id: customerId }, { onConflict: "owner_id" });
    }

    const session = await stripeRequest<{ id: string; url: string }>("/checkout/sessions", {
      body: {
        mode: "subscription",
        customer: customerId,
        client_reference_id: ownerId,
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: { metadata: { owner_id: ownerId } },
        metadata: { owner_id: ownerId, plan: "growth", founders: String(founders) },
        success_url: `${origin}/configuracoes?assinatura=processando`,
        cancel_url: `${origin}/planos?checkout=cancelado`,
      },
    });

    trackGrowthEvent("growth_checkout_started", ownerId, { founders });
    return { url: session.url, modo: "checkout" as const, motivo: null };
  });

/** Abre o Customer Portal da Stripe (cartão, faturas, cancelamento, reativação). */
export const abrirPortalAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { stripeRequest } = await import("@/lib/stripe.server");
    const { appOrigin, requireGestao } = await import("@/lib/billing.server");
    const ownerId = await requireGestao(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (!sub?.stripe_customer_id) throw new Error("Nenhuma assinatura encontrada para este estabelecimento.");

    const portal = await stripeRequest<{ url: string }>("/billing_portal/sessions", {
      body: { customer: sub.stripe_customer_id, return_url: `${appOrigin()}/configuracoes` },
    });
    return { url: portal.url };
  });
