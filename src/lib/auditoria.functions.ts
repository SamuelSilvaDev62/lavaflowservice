import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_ROLES = ["owner", "admin"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_any_role", {
    _user: userId,
    _roles: ADMIN_ROLES as unknown as string[],
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem permissão para acessar a auditoria");
}

const filtersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
  source: z.enum(["all", "equipe", "ai"]).default("all"),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export type AuditEvent = {
  id: string;
  timestamp: string;
  source: "equipe" | "ai";
  actor: { id: string | null; label: string };
  action: string;
  metadata: Record<string, any>;
};

export const getAuditActors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase.rpc("list_tenant_members");
    if (error) throw new Error(error.message);
    return (data ?? []).map((m: any) => ({
      userId: m.user_id as string,
      label: (m.funcionario_nome || m.email || "Usuário") as string,
      role: m.role as string,
    }));
  });

export const getAuditSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let eq = supabase.from("equipe_auditoria").select("id", { count: "exact", head: true });
    let ai = supabase.from("ai_usage_logs").select("estimated_cost, tokens_input, tokens_output");

    if (data.from) { eq = eq.gte("created_at", data.from); ai = ai.gte("created_at", data.from); }
    if (data.to) { eq = eq.lte("created_at", data.to); ai = ai.lte("created_at", data.to); }

    const [eqRes, aiRes] = await Promise.all([eq, ai]);
    if (eqRes.error) throw new Error(eqRes.error.message);
    if (aiRes.error) throw new Error(aiRes.error.message);

    const aiRows = (aiRes.data ?? []) as Array<{ estimated_cost: number; tokens_input: number; tokens_output: number }>;
    const aiCalls = aiRows.length;
    const aiCost = aiRows.reduce((s, r) => s + Number(r.estimated_cost || 0), 0);
    const aiTokens = aiRows.reduce((s, r) => s + (r.tokens_input || 0) + (r.tokens_output || 0), 0);

    return {
      equipeCount: eqRes.count ?? 0,
      aiCalls,
      aiCost,
      aiTokens,
    };
  });

export const getAuditEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filtersSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ events: AuditEvent[]; hasMore: boolean }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { source, from, to, userId: filterUser, limit, offset } = data;
    const window = limit + offset;

    // Build actor lookup once
    const { data: members } = await supabase.rpc("list_tenant_members");
    const actorMap = new Map<string, string>();
    for (const m of (members ?? []) as any[]) {
      actorMap.set(m.user_id, m.funcionario_nome || m.email || "Usuário");
    }

    const events: AuditEvent[] = [];

    if (source === "all" || source === "equipe") {
      let q = supabase
        .from("equipe_auditoria")
        .select("id, created_at, acao, metadata, funcionario_id, ordem_id, funcionarios(nome, auth_user_id)")
        .order("created_at", { ascending: false })
        .limit(window + 1);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      for (const r of (rows ?? []) as any[]) {
        const actorId = r.funcionarios?.auth_user_id ?? null;
        if (filterUser && actorId !== filterUser) continue;
        events.push({
          id: `eq:${r.id}`,
          timestamp: r.created_at,
          source: "equipe",
          actor: {
            id: actorId,
            label: r.funcionarios?.nome || (actorId && actorMap.get(actorId)) || "Sistema",
          },
          action: r.acao,
          metadata: { ...(r.metadata ?? {}), ordem_id: r.ordem_id, funcionario_id: r.funcionario_id },
        });
      }
    }

    if (source === "all" || source === "ai") {
      let q = supabase
        .from("ai_usage_logs")
        .select("id, created_at, user_id, route, tokens_input, tokens_output, estimated_cost")
        .order("created_at", { ascending: false })
        .limit(window + 1);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      if (filterUser) q = q.eq("user_id", filterUser);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      for (const r of (rows ?? []) as any[]) {
        events.push({
          id: `ai:${r.id}`,
          timestamp: r.created_at,
          source: "ai",
          actor: { id: r.user_id, label: actorMap.get(r.user_id) || "Usuário" },
          action: `IA · ${r.route}`,
          metadata: {
            tokens_input: r.tokens_input,
            tokens_output: r.tokens_output,
            estimated_cost: r.estimated_cost,
          },
        });
      }
    }

    events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    const page = events.slice(offset, offset + limit);
    const hasMore = events.length > offset + limit;
    return { events: page, hasMore };
  });
