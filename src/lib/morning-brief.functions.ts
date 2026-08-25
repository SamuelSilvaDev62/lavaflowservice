import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES_GESTAO = new Set(["owner", "admin", "gerente"]);

export const getMorningBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, assertFeature } = await import("@/lib/entitlements.server");
    const { buildMorningBrief } = await import("@/lib/morning-brief.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);

    if (!ROLES_GESTAO.has(role)) {
      throw new Error("Sem permissão para acessar o Morning Brief.");
    }

    await assertFeature(ownerId, "analises_inteligentes");
    return buildMorningBrief(context.supabase, ownerId);
  });
