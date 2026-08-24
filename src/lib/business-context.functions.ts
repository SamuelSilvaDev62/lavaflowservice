import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const textoOpcional = z.string().max(2000).optional().nullable();

const contextSchema = z.object({
  descricao: textoOpcional,
  posicionamento: textoOpcional,
  publico_alvo: textoOpcional,
  diferenciais: textoOpcional,
  tom_de_voz: textoOpcional,
  objetivos_marketing: textoOpcional,
  restricoes_campanhas: textoOpcional,
  cidade: z.string().max(120).optional().nullable(),
  estado: z.string().max(40).optional().nullable(),
  bairros_atendidos: z.string().max(500).optional().nullable(),
  concorrentes: z.string().max(500).optional().nullable(),
  google_business_url: z.string().max(500).optional().nullable(),
  instagram_url: z.string().max(500).optional().nullable(),
  facebook_url: z.string().max(500).optional().nullable(),
  tiktok_url: z.string().max(500).optional().nullable(),
  website_url: z.string().max(500).optional().nullable(),
  outras_referencias: textoOpcional,
});

/** Perfil de IA + contexto do negócio do tenant (owner/admin). */
export const getBusinessContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope } = await import("@/lib/entitlements.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Sem permissão para acessar o contexto do negócio.");
    }
    const [{ data: settings }, { data: empresa }] = await Promise.all([
      context.supabase
        .from("tenant_ai_settings")
        .select("ai_enabled, preferred_tone, business_context, updated_at")
        .eq("tenant_id", ownerId)
        .maybeSingle(),
      context.supabase
        .from("empresa")
        .select("nome_fantasia, endereco, horario_funcionamento, instagram, facebook, website, whatsapp, telefone")
        .eq("owner_id", ownerId)
        .maybeSingle(),
    ]);
    return {
      aiEnabled: settings?.ai_enabled ?? true,
      preferredTone: settings?.preferred_tone ?? null,
      businessContext: (settings?.business_context ?? {}) as Record<string, unknown>,
      atualizadoEm: settings?.updated_at ?? null,
      empresa: empresa ?? null,
    };
  });

export const updateBusinessContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ai_enabled: z.boolean().optional(),
        preferred_tone: z.string().max(120).optional().nullable(),
        business_context: contextSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveOwnerScope } = await import("@/lib/entitlements.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Sem permissão para editar o contexto do negócio.");
    }
    const limpo = Object.fromEntries(
      Object.entries(data.business_context).filter(([, v]) => v != null && String(v).trim() !== ""),
    );
    const { error } = await context.supabase
      .from("tenant_ai_settings")
      .upsert(
        {
          tenant_id: ownerId,
          ai_enabled: data.ai_enabled ?? true,
          preferred_tone: data.preferred_tone ?? null,
          business_context: limpo,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "tenant_id" },
      );
    if (error) throw error;
    return { ok: true };
  });
