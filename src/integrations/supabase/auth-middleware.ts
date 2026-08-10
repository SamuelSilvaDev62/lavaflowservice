// Commercial hardening: autenticação + assinatura/trial ativo.
// IMPORTANTE: este arquivo nasceu como gerado pelo Lovable. Se a integração
// Supabase regenerá-lo, preservar a verificação comercial abaixo.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

class SubscriptionRequiredError extends Error {
  statusCode = 402;

  constructor() {
    super("Assinatura ou período de teste ativo necessário para usar o LavaFlow.");
    this.name = "SubscriptionRequiredError";
  }
}

class SubscriptionCheckError extends Error {
  statusCode = 503;

  constructor() {
    super("Não foi possível verificar a assinatura neste momento.");
    this.name = "SubscriptionCheckError";
  }
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Connect Supabase in Lovable Cloud.`;
      console.error(`[Supabase] ${message}`);
      throw new Error(message);
    }

    const request = getRequest();
    if (!request?.headers) throw new Error("Unauthorized: No request headers available");

    const authHeader = request.headers.get("authorization");
    if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
    if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");

    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized: No token provided");

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) throw new Error("Unauthorized: Invalid token");
    if (!data.claims.sub) throw new Error("Unauthorized: No user ID found in token");

    // Fonte de verdade comercial centralizada no banco. A RPC usa
    // current_owner_id(), portanto funciona também para membros do tenant.
    const { data: subscriptionRows, error: subscriptionError } = await (supabase as any).rpc(
      "get_my_subscription",
    );
    if (subscriptionError) {
      console.error("[entitlement] falha em get_my_subscription", subscriptionError);
      throw new SubscriptionCheckError();
    }

    const subscriptionRow = Array.isArray(subscriptionRows)
      ? subscriptionRows[0] ?? null
      : subscriptionRows ?? null;
    const { getEntitlement } = await import("@/lib/plans");
    const entitlement = getEntitlement(subscriptionRow);

    // Trial válido (inclusive plan=null => Essencial), assinatura ativa e
    // carência de pagamento continuam operando; sem entitlement, fail closed.
    if (!entitlement.ativo || !entitlement.plan) throw new SubscriptionRequiredError();

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
        entitlement,
      },
    });
  },
);
