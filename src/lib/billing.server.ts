// Helpers de billing no SERVIDOR. Nunca importado pelo cliente.
import { getRequest } from "@tanstack/react-start/server";

/** Origem pública do app (para success/cancel/return urls). */
export function appOrigin(): string {
  const request = getRequest();
  const origin = request?.headers.get("origin");
  if (origin) return origin;
  const referer = request?.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      /* ignore */
    }
  }
  return process.env["APP_URL"] ?? "https://lavaflowservice.lovable.app";
}

/** Somente owner/admin do tenant podem mexer em assinatura. */
export async function requireGestao(supabase: any, userId: string): Promise<string> {
  const { resolveOwnerScope } = await import("@/lib/entitlements.server");
  const { ownerId, role } = await resolveOwnerScope(supabase, userId);
  if (role !== "owner" && role !== "admin") {
    throw new Error("Apenas o proprietário ou um administrador pode gerenciar a assinatura.");
  }
  return ownerId;
}
