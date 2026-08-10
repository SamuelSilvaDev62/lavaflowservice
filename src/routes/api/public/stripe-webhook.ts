import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook da Stripe (assinaturas). Fonte da verdade do plano do tenant.
 * Segurança: assinatura verificada com STRIPE_WEBHOOK_SECRET; owner_id nunca
 * é aceito do cliente — vem do metadata da Stripe ou do mapeamento persistido
 * (stripe_customer_id -> owner_id).
 */
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook não configurado", { status: 503 });

        const payload = await request.text();
        const { verifyStripeSignature, stripeRequest, priceIdMap } = await import("@/lib/stripe.server");
        const valid = await verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret);
        if (!valid) return new Response("Assinatura inválida", { status: 401 });

        let event: any;
        try { event = JSON.parse(payload); } catch { return new Response("Payload inválido", { status: 400 }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotência: evento já processado é ignorado. Qualquer outro erro de
        // banco retorna 500 para que a Stripe tente entregar o evento novamente.
        const { error: eventInsertError } = await supabaseAdmin
          .from("stripe_webhook_events")
          .insert({ id: String(event.id), type: String(event.type ?? "unknown") });
        if (eventInsertError) {
          const code = String((eventInsertError as any).code ?? "");
          if (code === "23505") return new Response("ok (duplicado)");
          console.error("[stripe-webhook] falha ao registrar evento", eventInsertError);
          return new Response("Erro ao registrar evento", { status: 500 });
        }

        const prices = priceIdMap();

        const resolveOwnerId = async (obj: any, customerId?: string | null): Promise<string | null> => {
          const fromMeta = obj?.metadata?.owner_id ?? obj?.client_reference_id ?? null;
          if (fromMeta) return String(fromMeta);
          if (customerId) {
            const { data } = await supabaseAdmin
              .from("tenant_subscriptions")
              .select("owner_id")
              .eq("stripe_customer_id", customerId)
              .maybeSingle();
            if (data?.owner_id) return data.owner_id;
            try {
              const customer = await stripeRequest<any>(`/customers/${customerId}`, { method: "GET" });
              if (customer?.metadata?.owner_id) return String(customer.metadata.owner_id);
            } catch { /* ignore */ }
          }
          return null;
        };

        const applySubscription = async (subscription: any, ownerIdHint?: string | null) => {
          const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
          const ownerId = ownerIdHint ?? (await resolveOwnerId(subscription, customerId));
          if (!ownerId) throw new Error(`owner_id não resolvido para subscription ${subscription.id}`);

          const item = subscription.items?.data?.[0];
          const priceId = item?.price?.id ?? null;
          const mapped = priceId ? prices[priceId] : undefined;
          const periodEndUnix = subscription.current_period_end ?? item?.current_period_end;
          const status = String(subscription.status ?? "incomplete");
          // Cancelada/expirada: nunca apaga dados — apenas remove o entitlement.
          const encerrada = status === "canceled" || status === "incomplete_expired";

          // Em uma assinatura vigente, Price ID desconhecido é erro de configuração.
          // Não removemos o plano silenciosamente: retornamos 500 para possibilitar
          // correção dos secrets e retry do mesmo evento.
          if (!encerrada && !mapped) {
            throw new Error(`Stripe Price ID não reconhecido: ${priceId ?? "ausente"}`);
          }

          const { error } = await supabaseAdmin.from("tenant_subscriptions").upsert(
            {
              owner_id: ownerId,
              stripe_customer_id: customerId ?? null,
              stripe_subscription_id: subscription.id ?? null,
              stripe_price_id: priceId,
              plan: encerrada ? null : mapped!.plan,
              is_founders: encerrada ? false : !!mapped?.founders,
              subscription_status: status,
              cancel_at_period_end: !!subscription.cancel_at_period_end,
              current_period_end: periodEndUnix ? new Date(Number(periodEndUnix) * 1000).toISOString() : null,
            },
            { onConflict: "owner_id" },
          );
          if (error) throw error;

          const { error: ownerEventError } = await supabaseAdmin
            .from("stripe_webhook_events")
            .update({ owner_id: ownerId })
            .eq("id", String(event.id));
          if (ownerEventError) throw ownerEventError;
        };

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              const ownerId = await resolveOwnerId(session, session.customer);
              if (session.subscription) {
                const subscription = await stripeRequest<any>(`/subscriptions/${session.subscription}`, { method: "GET" });
                await applySubscription(subscription, ownerId);
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
            case "customer.subscription.paused":
            case "customer.subscription.resumed": {
              await applySubscription(event.data.object);
              break;
            }
            case "invoice.paid":
            case "invoice.payment_succeeded":
            case "invoice.payment_failed": {
              const invoice = event.data.object;
              const subId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
              if (subId) {
                const subscription = await stripeRequest<any>(`/subscriptions/${subId}`, { method: "GET" });
                await applySubscription(subscription);
              }
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error("[stripe-webhook] erro ao processar", event.type, err);
          // Remove o registro de idempotência para permitir retry da Stripe.
          await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", String(event.id));
          return new Response("Erro ao processar", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
