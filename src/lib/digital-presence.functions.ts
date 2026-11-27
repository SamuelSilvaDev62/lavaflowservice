import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DIGITAL_STEPS,
  googleMetrics,
  isGoogleReference,
  presenceChecklist,
  type DigitalConfirmations,
} from "./digital-presence";
import { mergeEmpresaIntoContext, type BusinessContext } from "./business-context";

const reference = z
  .string()
  .trim()
  .max(500)
  .refine(isGoogleReference, "Informe um link HTTPS do Google válido.");
const step = z.enum(["created", "verified", "photos", "booking"]);

export const getDigitalPresence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { resolveOwnerScope, assertFeature } = await import("@/lib/entitlements.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (!["owner", "admin", "gerente"].includes(role))
      throw new Error("Sem permissão para Presença Digital.");
    await assertFeature(ownerId, "oportunidades");
    const db = context.supabase;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [settings, empresa, ai, services, completed] = await Promise.all([
      db
        .from("digital_presence")
        .select("profile_url, review_url, confirmations, updated_at")
        .eq("owner_id", ownerId)
        .maybeSingle(),
      db
        .from("empresa")
        .select(
          "nome_fantasia, endereco, horario_funcionamento, whatsapp, telefone, slug, instagram, facebook, website",
        )
        .eq("owner_id", ownerId)
        .maybeSingle(),
      db
        .from("tenant_ai_settings")
        .select("business_context, ai_enabled")
        .eq("tenant_id", ownerId)
        .maybeSingle(),
      db
        .from("servicos")
        .select("nome, categoria, preco_padrao")
        .eq("owner_id", ownerId)
        .eq("ativo", true)
        .order("nome"),
      db
        .from("ordens_servico")
        .select("id, created_at, clientes:clientes!ordens_servico_cliente_id_fkey(nome, telefone)")
        .eq("owner_id", ownerId)
        .eq("status", "entregue")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    for (const result of [settings, empresa, ai, services, completed])
      if (result.error) throw result.error;
    const business = mergeEmpresaIntoContext(
      (ai.data?.business_context ?? {}) as BusinessContext,
      empresa.data,
    );
    const confirmations = (settings.data?.confirmations ?? {}) as DigitalConfirmations;
    type Booking = { origem: string; status: string; ordem_id: string | null };
    const bookings: Booking[] = [];
    // Complete, deterministic period scan; never display a truncated total.
    for (let offset = 0; ; offset += 500) {
      if (offset >= 10000)
        throw new Error(
          "Volume do período excedeu a consulta segura. Nenhuma métrica parcial foi exibida.",
        );
      const result = await db
        .from("agendamentos")
        .select("id, origem, status, ordem_id")
        .eq("owner_id", ownerId)
        .eq("origem", "google")
        .gte("created_at", since)
        .order("id")
        .range(offset, offset + 499);
      if (result.error) throw result.error;
      bookings.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 500) break;
    }
    const ids = [
      ...new Set(bookings.flatMap((booking) => (booking.ordem_id ? [booking.ordem_id] : []))),
    ];
    const orders: Array<{ id: string; status: string; valor: number | null }> = [];
    for (let i = 0; i < ids.length; i += 100) {
      const result = await db
        .from("ordens_servico")
        .select("id, status, valor")
        .eq("owner_id", ownerId)
        .in("id", ids.slice(i, i + 100));
      if (result.error) throw result.error;
      orders.push(...(result.data ?? []));
    }
    return {
      profileUrl: settings.data?.profile_url || business.google_business_url || "",
      reviewUrl: settings.data?.review_url ?? "",
      confirmations,
      empresa: empresa.data,
      business,
      services: services.data ?? [],
      aiEnabled: ai.data?.ai_enabled === true,
      checklist: presenceChecklist({
        empresa: empresa.data,
        context: business,
        services: services.data?.length ?? 0,
        confirmations,
      }),
      metrics: googleMetrics(bookings, orders),
      periodStart: since,
      completed: completed.data ?? [],
      canEditKnowledge: ["owner", "admin"].includes(role),
    };
  });

export const saveDigitalPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) =>
    z
      .object({
        profileUrl: reference.optional(),
        reviewUrl: reference.optional(),
        confirmation: z.object({ step, done: z.boolean() }).optional(),
      })
      .strict()
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    const { resolveOwnerScope, assertFeature } = await import("@/lib/entitlements.server");
    const { ownerId, role } = await resolveOwnerScope(context.supabase, context.userId);
    if (!["owner", "admin", "gerente"].includes(role))
      throw new Error("Sem permissão para editar Presença Digital.");
    await assertFeature(ownerId, "oportunidades");
    // Patch columns independently; concurrent link saves never reset checklist.
    const now = new Date().toISOString();
    const db = context.supabase;
    if (data.confirmation) {
      const result = await db.rpc("set_digital_presence_confirmation", {
        p_step: data.confirmation.step,
        p_done: data.confirmation.done,
      });
      if (result.error) throw result.error;
    } else {
      const result = await db.from("digital_presence").upsert(
        {
          owner_id: ownerId,
          updated_by: context.userId,
          updated_at: now,
          ...(data.profileUrl !== undefined ? { profile_url: data.profileUrl } : {}),
          ...(data.reviewUrl !== undefined ? { review_url: data.reviewUrl } : {}),
        },
        { onConflict: "owner_id", ignoreDuplicates: true },
      );
      if (result.error) throw result.error;
      const patch = await db
        .from("digital_presence")
        .update({
          updated_by: context.userId,
          updated_at: now,
          ...(data.profileUrl !== undefined ? { profile_url: data.profileUrl } : {}),
          ...(data.reviewUrl !== undefined ? { review_url: data.reviewUrl } : {}),
        })
        .eq("owner_id", ownerId);
      if (patch.error) throw patch.error;
    }
    return { ok: true, steps: DIGITAL_STEPS.length };
  });
