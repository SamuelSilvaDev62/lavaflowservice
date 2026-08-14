// Cliente Stripe mínimo via REST (compatível com o runtime Worker).
// Nunca importe este arquivo em código de cliente.

const STRIPE_API = "https://api.stripe.com/v1";

export function getStripeKey(): string {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    throw new Error(
      "Stripe não configurado. Adicione STRIPE_SECRET_KEY em Configurações do Projeto → Secrets.",
    );
  }
  return key;
}

export function isStripeConfigured(): boolean {
  return !!process.env["STRIPE_SECRET_KEY"];
}

function encodeForm(data: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      parts.push(...encodeForm(value as Record<string, unknown>, name));
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === "object" && v !== null) {
          parts.push(...encodeForm(v as Record<string, unknown>, `${name}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(v))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

export async function stripeRequest<T = any>(
  path: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown>; idempotencyKey?: string } = {},
): Promise<T> {
  const method = options.method ?? "POST";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getStripeKey()}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const body = options.body ? encodeForm(options.body).join("&") : undefined;
  const url = method === "GET" && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;

  const res = await fetch(url, { method, headers, body: method === "GET" ? undefined : body });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? `Falha na Stripe (${res.status})`;
    console.error("[stripe] erro", path, res.status, msg);
    throw new Error(msg);
  }
  return json as T;
}

/** Verifica a assinatura do webhook (esquema v1 da Stripe) com Web Crypto. */
export async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(",").map((p) => p.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // comparação em tempo constante
  return signatures.some((sig) => {
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

/** Mapa Price ID -> plano, resolvido a partir dos secrets do servidor. */
export function priceIdMap(): Record<string, { plan: "essencial" | "growth" | "intelligence"; founders: boolean }> {
  const map: Record<string, { plan: "essencial" | "growth" | "intelligence"; founders: boolean }> = {};
  const add = (env: string, plan: "essencial" | "growth" | "intelligence", founders = false) => {
    const id = process.env[env];
    if (id) map[id] = { plan, founders };
  };
  add("STRIPE_PRICE_ESSENCIAL", "essencial");
  add("STRIPE_PRICE_GROWTH", "growth");
  add("STRIPE_PRICE_INTELLIGENCE", "intelligence");
  add("STRIPE_PRICE_FOUNDERS", "intelligence", true);
  return map;
}

/**
 * Configuração opcional do Customer Portal (legado).
 * NÃO é requisito no modelo atual: com um único plano público pago, o portal
 * genérico já cobre cartão, faturas e cancelamento. Troca de plano não existe.
 */
export function getPortalConfigurationId(): string | undefined {
  return process.env["STRIPE_PORTAL_CONFIGURATION_ID"] || undefined;
}

/** Status Stripe em que a assinatura AINDA existe (não pode ser duplicada). */
export const NON_TERMINAL_STRIPE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

export type StripeSubscription = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  items?: { data: Array<{ id: string; price?: { id: string } }> };
};

export const DUPLICADAS_MSG =
  "Encontramos mais de uma assinatura ativa para esta conta. Para evitar cobrança ou alteração incorreta, regularize as assinaturas duplicadas antes de trocar de plano.";

/** Todas as assinaturas não-terminais do customer (nunca escolhe uma). */
export async function listNonTerminalSubscriptions(customerId: string): Promise<StripeSubscription[]> {
  const res = await stripeRequest<{ data: StripeSubscription[] }>("/subscriptions", {
    method: "GET",
    body: { customer: customerId, status: "all", limit: 100 },
  });
  return (res.data ?? []).filter((s) => NON_TERMINAL_STRIPE_STATUSES.has(String(s.status)));
}

/**
 * Resolve a assinatura viva de forma segura:
 * 0 -> null; 1 -> a única; >1 -> bloqueia (duplicidade precisa de correção manual).
 */
export async function resolveUniqueLiveSubscription(
  customerId: string,
  ownerId: string,
): Promise<StripeSubscription | null> {
  const vivas = await listNonTerminalSubscriptions(customerId);
  if (vivas.length > 1) {
    console.error("[billing] assinaturas duplicadas não-terminais", {
      ownerId,
      customerId,
      subscriptionIds: vivas.map((s) => s.id),
    });
    throw new Error(DUPLICADAS_MSG);
  }
  return vivas[0] ?? null;
}


export async function retrieveSubscription(id: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(`/subscriptions/${id}`, { method: "GET" });
}

/** Price ID do plano público (nunca Founders). */
export function priceIdForPlan(plan: "essencial" | "growth" | "intelligence"): { env: string; id?: string } {
  const env =
    plan === "essencial"
      ? "STRIPE_PRICE_ESSENCIAL"
      : plan === "growth"
        ? "STRIPE_PRICE_GROWTH"
        : "STRIPE_PRICE_INTELLIGENCE";
  return { env, id: process.env[env] };
}

/**
 * Valida (read-only) o Price do Growth antes de qualquer Checkout:
 * precisa existir, estar ativo, ser recorrente mensal em BRL e valer R$ 99,00.
 * Evita cobrar valor divergente da promessa pública.
 */
export async function assertGrowthPriceValido(): Promise<string> {
  const id = process.env["STRIPE_PRICE_GROWTH"];
  if (!id) {
    throw new Error("Assinatura indisponível: preço do Growth não configurado neste ambiente.");
  }
  const price = await stripeRequest<{
    id: string;
    active?: boolean;
    currency?: string;
    unit_amount?: number | null;
    recurring?: { interval?: string } | null;
  }>(`/prices/${id}`, { method: "GET" });

  const ok =
    price.active !== false &&
    price.currency === "brl" &&
    price.recurring?.interval === "month" &&
    price.unit_amount === 9900;

  if (!ok) {
    console.error("[billing] Price do Growth divergente", {
      priceId: `${id.slice(0, 12)}…`,
      active: price.active,
      currency: price.currency,
      unitAmount: price.unit_amount,
      interval: price.recurring?.interval,
    });
    throw new Error(
      "Assinatura temporariamente indisponível: o preço configurado não corresponde ao Growth de R$ 99/mês. Nada foi cobrado.",
    );
  }
  return id;
}
