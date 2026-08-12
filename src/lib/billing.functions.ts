import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLAN_IDS = ["essencial", "growth", "intelligence"] as const;

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
 * Inicia o Checkout da Stripe (assinatura recorrente). Somente owner/admin.
 * Anti-duplicação: se existir QUALQUER assinatura não-terminal na Stripe para o
 * customer (mesmo que o banco local esteja desatualizado), nenhum novo Checkout
 * é criado — a troca de plano deve usar `trocarPlanoAssinatura`.
 */
export const criarCheckoutAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan: z.enum(PLAN_IDS), founders: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { stripeRequest, resolveUniqueLiveSubscription, priceIdForPlan } = await import("@/lib/stripe.server");
    const { appOrigin, requireGestao } = await import("@/lib/billing.server");
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
          console.warn(
            "[billing] inconsistência: banco aponta para",
            sub.stripe_subscription_id,
            "mas a Stripe tem",
            existente.id,
            "para o tenant",
            ownerId,
          );
        }
        return {
          modo: "trocar" as const,
          url: null,
          motivo:
            "Já existe uma assinatura ativa para este estabelecimento. Use a troca de plano para alterar o valor cobrado.",
        };
      }
    }

    // Founders é oferta interna: só válida para quem já foi marcado no banco
    // E somente quando o fluxo Founders é escolhido explicitamente.
    const founders = !!sub?.is_founders && data.founders === true;
    const priceEnv = founders ? "STRIPE_PRICE_FOUNDERS" : priceIdForPlan(data.plan).env;
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

    return { url: session.url, modo: "checkout" as const, motivo: null };
  });

/**
 * Troca de plano de uma assinatura EXISTENTE (upgrade/downgrade).
 * Usa o deep link do Customer Portal `subscription_update_confirm`, que mostra
 * prorrata/próxima cobrança e trata falha de pagamento/3DS. Nunca cria nova
 * assinatura — portanto nunca duplica cobrança.
 */
export const trocarPlanoAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan: z.enum(PLAN_IDS) }).parse(d))
  .handler(async ({ data, context }) => {
    const {
      stripeRequest,
      resolveUniqueLiveSubscription,
      retrieveSubscription,
      priceIdForPlan,
      getPortalConfigurationId,
    } = await import("@/lib/stripe.server");
    const { appOrigin, requireGestao } = await import("@/lib/billing.server");
    const ownerId = await requireGestao(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      throw new Error("Nenhuma assinatura encontrada para este estabelecimento.");
    }

    const { env, id: priceId } = priceIdForPlan(data.plan);
    if (!priceId) throw new Error(`Preço da Stripe não configurado (${env}).`);

    // A assinatura viva na Stripe manda — o registro local pode estar atrasado.
    const viva = await resolveUniqueLiveSubscription(sub.stripe_customer_id, ownerId);
    if (!viva) throw new Error("Não há assinatura ativa para trocar. Assine um plano primeiro.");
    if (sub.stripe_subscription_id && sub.stripe_subscription_id !== viva.id) {
      console.warn("[billing] troca de plano em subscription divergente do banco", {
        ownerId,
        local: sub.stripe_subscription_id,
        stripe: viva.id,
      });
    }

    const full = viva.items?.data?.length ? viva : await retrieveSubscription(viva.id);
    const item = full.items?.data?.[0];
    if (!item) throw new Error("Não foi possível identificar o item da assinatura na Stripe.");
    if (item.price?.id === priceId) {
      return { url: null, modo: "atual" as const };
    }

    const configuration = getPortalConfigurationId();
    const returnUrl = `${appOrigin()}/configuracoes?assinatura=processando`;

    try {
      const portal = await stripeRequest<{ url: string }>("/billing_portal/sessions", {
        body: {
          customer: sub.stripe_customer_id,
          ...(configuration ? { configuration } : {}),
          flow_data: {
            type: "subscription_update_confirm",
            subscription_update_confirm: {
              subscription: full.id,
              items: [{ id: item.id, price: priceId, quantity: 1 }],
            },
            after_completion: { type: "redirect", redirect: { return_url: returnUrl } },
          },
        },
      });
      return { url: portal.url, modo: "trocar" as const };
    } catch (err: any) {
      console.error("[billing] falha no deep link de troca de plano", err?.message);
      throw new Error(
        "Não foi possível abrir a troca de plano. Habilite “atualizar assinatura” na configuração do Customer Portal da Stripe (e informe STRIPE_PORTAL_CONFIGURATION_ID) e tente novamente.",
      );
    }
  });


/** Abre o Customer Portal da Stripe para o tenant autenticado. */
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
