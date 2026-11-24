import { getRequest, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import { ACCESS_LIMITS, trustedEdgeIp, type AccessAction } from "@/lib/access-limit";

export class AccessLimitError extends Error {
  readonly statusCode = 429;
  constructor(readonly retryAfter: number) {
    super("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Durable counters only; fail closed on database errors. No plaintext PII stored.
 * Use a global preflight before slug lookup, then tenant/identity limits.
 */
export async function enforceAccessLimit(
  action: AccessAction,
  scope: { tenant?: string; identity?: string; headers?: Headers } = {},
): Promise<void> {
  const policy = ACCESS_LIMITS[action];
  const headers = scope.headers ?? getRequest().headers;
  const ip = trustedEdgeIp(headers, process.env["VERIFIED_EDGE_IP_HEADER"]);
  const buckets: { key: string; max: number; seconds: number }[] = [];
  const add = async (key: string, max: number) => buckets.push({ key: await digest(key), max, seconds: policy.seconds });
  if (!scope.tenant) {
    await add(`${action}:global`, policy.global);
    if (ip) await add(`${action}:ip:${ip}`, policy.ip);
  } else {
    await add(`${action}:tenant:${scope.tenant}`, policy.tenant);
    if (scope.identity) await add(`${action}:identity:${scope.tenant}:${scope.identity}`, policy.identity);
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_access_limits", { p_buckets: buckets });
  if (error || !data?.[0]) throw new Error("Proteção de acesso temporariamente indisponível. Tente novamente mais tarde.");
  const result = data[0];
  if (!result.allowed) {
    const retryAfter = Math.max(1, result.retry_after);
    setResponseStatus(429);
    setResponseHeader("Retry-After", String(retryAfter));
    throw new AccessLimitError(retryAfter);
  }
}