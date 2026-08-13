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

        // Idempotência: só 23505 (unique_violation) é duplicado.
        // Qualquer outro erro de banco é falha real => 500 para a Stripe reenviar.
        const { error: dupErr } = await supabaseAdmin
          .from("stripe_webhook_events")
          .insert({ id: String(event.id), type: String(event.type ?? "unknown") });
        if (dupErr) {
          const code = String((dupErr as any).code ?? "");
          if (code === "23505") return new Response("ok (duplicado)");
          console.error("[stripe-webhook] falha ao registrar evento", { code, message: (dupErr as any).message });
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
          if (!ownerId) {
            // Nunca sucesso silencioso: deixa a Stripe reenviar.
            throw new Error(`owner_id não resolvido para subscription ${String(subscription?.id ?? "?")}`);
          }

          const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
          const mapped = priceId ? prices[priceId] : undefined;
          const periodEndUnix = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
          const status = String(subscription.status ?? "incomplete");
          // Cancelada/expirada: nunca apaga dados — apenas remove o entitlement.
          const encerrada = status === "canceled" || status === "incomplete_expired";

          // Estado comercial atual (para preservar campos que não devemos perder).
          const { data: atual, error: readErr } = await supabaseAdmin
            .from("tenant_subscriptions")
            .select("plan, is_founders")
            .eq("owner_id", ownerId)
            .maybeSingle();
          if (readErr) throw new Error(`falha ao ler tenant_subscriptions: ${readErr.message}`);

          // Price ID desconhecido em assinatura viva: falha explícita, sem zerar entitlement.
          if (!encerrada && !mapped) {
            throw new Error(
              `Price ID não mapeado (${String(priceId)}) para subscription ${String(subscription?.id ?? "?")} — entitlement preservado`,
            );
          }

          // Founders é elegibilidade histórica: nunca rebaixa por cancelamento
          // nem por price desconhecido.
          const isFounders = mapped ? (mapped.founders || !!atual?.is_founders) : !!atual?.is_founders;

          const { error: upsertErr } = await supabaseAdmin.from("tenant_subscriptions").upsert(
            {
              owner_id: ownerId,
              stripe_customer_id: customerId ?? null,
              stripe_subscription_id: subscription.id ?? null,
              stripe_price_id: priceId,
              // Terminal: remove o plano (acesso cai por status/plan).
              // Ativa: usa o plano mapeado.
              plan: encerrada ? null : (mapped?.plan ?? atual?.plan ?? null),
              is_founders: isFounders,
              subscription_status: status,
              cancel_at_period_end: !!subscription.cancel_at_period_end,
              current_period_end: periodEndUnix ? new Date(Number(periodEndUnix) * 1000).toISOString() : null,
            },
            { onConflict: "owner_id" },
          );
          if (upsertErr) throw new Error(`falha ao gravar tenant_subscriptions: ${upsertErr.message}`);

          const { error: linkErr } = await supabaseAdmin
            .from("stripe_webhook_events")
            .update({ owner_id: ownerId })
            .eq("id", String(event.id));
          if (linkErr) throw new Error(`falha ao vincular evento ao owner: ${linkErr.message}`);
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
          console.error("[stripe-webhook] erro ao processar", event.type, err instanceof Error ? err.message : "erro");
          // Remove o registro de idempotência para permitir retry da Stripe.
          await supabaseAdmin.from("stripe_webhook_events").delete().eq("id", String(event.id));
          return new Response("Erro ao processar", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
