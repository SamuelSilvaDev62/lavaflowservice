import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuthOnly as requireSupabaseAuth } from "@/integrations/supabase/auth-only-middleware";

const PLAN_IDS = ["essencial", "growth", "intelligence"] as const;
const MANAGE_EXISTING_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);

function appOrigin(): string {
  const request = getRequest();
  const origin = request?.headers.get("origin");
  if (origin) return origin;
  const referer = request?.headers.get("referer");
  if (referer) {
    try { return new URL(referer).origin; } catch { /* ignore */ }
  }
  return process.env["APP_URL"] ?? "https://lavaflowservice.lovable.app";
}

/** Plano/assinatura do tenant atual (usado pela UI e pelos gates). */
export const getMeuPlano = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, fetchEntitlement } = await import("@/lib/entitlements.server");
    const { isStripeConfigured } = await import("@/lib/stripe.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entitlement = await fetchEntitlement(supabaseAdmin, ownerId);
    return { entitlement, role, stripeConfigurado: isStripeConfigured() };
  });

/**
 * Inicia o Checkout da Stripe para uma NOVA assinatura.
 * Se o tenant já possui uma assinatura Stripe vigente, redireciona para o
 * Customer Portal em vez de criar uma segunda assinatura para o mesmo cliente.
 */
export const criarCheckoutAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan: z.enum(PLAN_IDS), founders: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveOwnerScope } = await import("@/lib/entitlements.server");
    const { stripeRequest } = await import("@/lib/stripe.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Apenas o proprietário ou um administrador pode contratar o plano.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, subscription_status, is_founders")
      .eq("owner_id", ownerId)
      .maybeSingle();

    const origin = appOrigin();

    // Uma assinatura Stripe existente deve ser alterada/gerenciada, nunca duplicada.
    if (
      sub?.stripe_customer_id &&
      sub?.stripe_subscription_id &&
      MANAGE_EXISTING_STATUSES.has(String(sub.subscription_status ?? ""))
    ) {
      const portal = await stripeRequest<{ url: string }>("/billing_portal/sessions", {
        body: {
          customer: sub.stripe_customer_id,
          return_url: `${origin}/configuracoes?assinatura=gerenciada`,
        },
      });
      return { url: portal.url, destination: "portal" as const };
    }

    // Founders é oferta interna: só válida para quem já foi marcado no banco.
    const founders = !!sub?.is_founders && !!data.founders;
    const priceEnv = founders
      ? "STRIPE_PRICE_FOUNDERS"
      : data.plan === "essencial"
        ? "STRIPE_PRICE_ESSENCIAL"
        : data.plan === "growth"
          ? "STRIPE_PRICE_GROWTH"
          : "STRIPE_PRICE_INTELLIGENCE";
    const priceId = process.env[priceEnv];
    if (!priceId) throw new Error(`Preço da Stripe não configurado (${priceEnv}).`);

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
        metadata: { owner_id: ownerId, plan: data.plan, founders: String(founders) },
        success_url: `${origin}/configuracoes?assinatura=processando`,
        cancel_url: `${origin}/planos?checkout=cancelado`,
      },
    });

    return { url: session.url, destination: "checkout" as const };
  });

/** Abre o Customer Portal da Stripe para o tenant autenticado. */
export const abrirPortalAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope } = await import("@/lib/entitlements.server");
    const { stripeRequest } = await import("@/lib/stripe.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Apenas o proprietário ou um administrador pode gerenciar a assinatura.");
    }

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
