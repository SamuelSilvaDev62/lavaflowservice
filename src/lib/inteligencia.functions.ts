import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeOpenSquadTask } from "@/lib/flow-engine/opensquad-adapter.server";
import { generateBusinessInsights as runBusinessRules } from "@/lib/flow-engine/rule-engine";
import { getSegmentTemplate } from "@/lib/flow-engine/segment-templates";
import { decideFlowTask } from "@/lib/flow-engine/task-router";
import type { BusinessInsight, FlowTaskRequest, OpenSquadTaskRequest } from "@/lib/flow-engine/types";

type TenantRole = "owner" | "admin" | "gerente" | "atendente" | "lavador" | "colaborador";

const ADMIN_ROLES: TenantRole[] = ["owner", "admin"];
const GESTAO_ROLES: TenantRole[] = ["owner", "admin", "gerente"];

function assertTenantRole(role: TenantRole, allowed: TenantRole[], message = "Sem permissao para executar esta acao.") {
  if (!allowed.includes(role)) throw new Error(message);
}

async function getOwnerScope(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("owner_id, role, created_at").eq("user_id", userId);
  const priority: Record<TenantRole, number> = {
    owner: 1,
    admin: 2,
    gerente: 3,
    atendente: 4,
    lavador: 5,
    colaborador: 5,
  };
  const rows = (data ?? []) as Array<{ owner_id: string; role: TenantRole; created_at?: string | null }>;
  const selfOwner = rows.find((r) => r.owner_id === userId && r.role === "owner");
  const sorted = rows.slice().sort((a, b) => {
    const byRole = (priority[a.role] ?? 99) - (priority[b.role] ?? 99);
    if (byRole) return byRole;
    const byCreated = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    if (byCreated) return byCreated;
    return String(a.owner_id).localeCompare(String(b.owner_id));
  });
  const current = selfOwner ?? sorted[0];
  return {
    ownerId: current?.owner_id ?? userId,
    role: (current?.role ?? "owner") as TenantRole,
  };
}

function table(supabase: any, name: string) {
  return (supabase as any).from(name);
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

async function hashInput(input: unknown) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function ensureAISettings(supabase: any, ownerId: string) {
  const defaults = {
    tenant_id: ownerId,
    ai_enabled: true,
    monthly_token_limit: 200000,
    monthly_task_limit: 300,
    auto_insights_enabled: true,
    auto_execute_enabled: false,
    preferred_tone: "profissional",
    business_context: {},
  };

  const { data, error } = await table(supabase, "tenant_ai_settings")
    .select("*")
    .eq("tenant_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: inserted, error: insertError } = await table(supabase, "tenant_ai_settings")
    .insert(defaults)
    .select("*")
    .single();
  if (insertError) throw insertError;
  return inserted ?? defaults;
}

async function getBusinessContext(supabase: any, ownerId: string, settings?: any) {
  const [{ data: empresa }, { data: servicos }] = await Promise.all([
    supabase.from("empresa").select("nome_fantasia, endereco, horario_funcionamento").eq("owner_id", ownerId).maybeSingle(),
    supabase.from("servicos").select("nome, categoria, preco_padrao, ativo").eq("owner_id", ownerId).eq("ativo", true).order("nome").limit(12),
  ]);
  return {
    segment: "lava_rapido",
    businessName: empresa?.nome_fantasia ?? "LavaFlow",
    location: empresa?.endereco ?? null,
    tone: settings?.preferred_tone ?? "profissional",
    labels: getSegmentTemplate("lava_rapido").labels,
    mainServices: (servicos ?? []).map((s: any) => s.nome),
    ...(settings?.business_context ?? {}),
  };
}

async function collectOperationalMetrics(supabase: any, ownerId: string) {
  const currentStart = daysAgoIso(30);
  const previousStart = daysAgoIso(60);
  const previousEnd = currentStart;
  const ninetyAgo = daysAgoIso(90);
  const fortyFiveAgo = daysAgoIso(45);

  const [
    { data: clientes },
    { data: ordens90 },
    { data: ordensCurrent },
    { data: ordensPrevious },
    { data: recompensas },
    { data: agendamentos },
    { data: agendaConfig },
  ] = await Promise.all([
    supabase.from("clientes").select("id, nome, telefone, pontos_saldo").eq("owner_id", ownerId),
    supabase.from("ordens_servico")
      .select("id, cliente_id, valor, created_at, servico_id, servicos:servico_id(nome, preco_padrao, categoria)")
      .eq("owner_id", ownerId)
      .gte("created_at", ninetyAgo),
    supabase.from("ordens_servico")
      .select("id, cliente_id, valor, created_at, servico_id, servicos:servico_id(nome, preco_padrao, categoria)")
      .eq("owner_id", ownerId)
      .gte("created_at", currentStart),
    supabase.from("ordens_servico")
      .select("id, cliente_id, valor, created_at, servico_id, servicos:servico_id(nome, preco_padrao, categoria)")
      .eq("owner_id", ownerId)
      .gte("created_at", previousStart)
      .lt("created_at", previousEnd),
    supabase.from("recompensas").select("custo_pontos").eq("owner_id", ownerId).eq("ativo", true).order("custo_pontos").limit(1),
    supabase.from("agendamentos")
      .select("id, data_agendada, status")
      .eq("owner_id", ownerId)
      .gte("data_agendada", todayIso())
      .lte("data_agendada", addDaysIso(7)),
    supabase.from("agenda_config").select("capacidade_simultanea").eq("owner_id", ownerId).maybeSingle(),
  ]);

  const clientesRows = clientes ?? [];
  const ordensRows = ordens90 ?? [];
  const ordensAtuais = ordensCurrent ?? [];
  const ordensAnteriores = ordensPrevious ?? [];
  const ticketMedio = ordensRows.length
    ? ordensRows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0) / ordensRows.length
    : 50;

  const lastVisit = new Map<string, string>();
  ordensRows.forEach((row: any) => {
    if (!lastVisit.has(row.cliente_id) || lastVisit.get(row.cliente_id)! < row.created_at) lastVisit.set(row.cliente_id, row.created_at);
  });
  const inactiveClients = clientesRows.filter((c: any) => !lastVisit.get(c.id) || lastVisit.get(c.id)! < fortyFiveAgo);
  const minReward = Number(recompensas?.[0]?.custo_pontos ?? 0);
  const rewardReadyClients = minReward
    ? clientesRows.filter((c: any) => Number(c.pontos_saldo ?? 0) >= minReward).length
    : 0;

  const activeAppointments = (agendamentos ?? []).filter((a: any) => !["cancelado", "nao_compareceu"].includes(a.status));
  const byDay = new Map<string, number>();
  activeAppointments.forEach((a: any) => byDay.set(a.data_agendada, (byDay.get(a.data_agendada) ?? 0) + 1));
  const capacity = Math.max(1, Number(agendaConfig?.capacidade_simultanea ?? 2));
  const expectedSlots = capacity * 8 * 7;
  const occupancyRate = activeAppointments.length / Math.max(1, expectedSlots);
  const lowOccupancyDays = Array.from({ length: 7 })
    .map((_, idx) => byDay.get(addDaysIso(idx)) ?? 0)
    .filter((count) => count <= Math.max(1, capacity)).length;

  const currentRevenue = ordensAtuais.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
  const previousRevenue = ordensAnteriores.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);

  const allPriced = [...ordensAtuais, ...ordensAnteriores].map((o: any) => Number(o.servicos?.preco_padrao ?? o.valor ?? 0)).filter((v) => v > 0);
  const avgPrice = allPriced.length ? allPriced.reduce((sum, value) => sum + value, 0) / allPriced.length : 0;
  const premiumNow = ordensAtuais.filter((o: any) => Number(o.servicos?.preco_padrao ?? o.valor ?? 0) >= avgPrice * 1.25).length;
  const premiumBefore = ordensAnteriores.filter((o: any) => Number(o.servicos?.preco_padrao ?? o.valor ?? 0) >= avgPrice * 1.25).length;
  const premiumServiceDropPct = premiumBefore > 0 ? (premiumNow - premiumBefore) / premiumBefore : 0;

  return {
    tenantId: ownerId,
    inactiveClients: inactiveClients.length,
    inactiveRevenuePotential: roundMoney(inactiveClients.length * ticketMedio),
    lowOccupancyDays,
    occupancyRate,
    currentRevenue: roundMoney(currentRevenue),
    previousRevenue: roundMoney(previousRevenue),
    averageTicket: roundMoney(ticketMedio),
    rewardReadyClients,
    premiumServiceDropPct,
    counts: {
      ordersCurrent: ordensAtuais.length,
      ordersPrevious: ordensAnteriores.length,
      clients: clientesRows.length,
      activeAppointments: activeAppointments.length,
    },
  };
}

function mapInsightToRow(insight: BusinessInsight) {
  return {
    tenant_id: insight.tenantId,
    module: insight.module,
    severity: insight.severity,
    title: insight.title,
    description: insight.description,
    metric_key: insight.metric ?? null,
    metric_value: insight.value ?? null,
    action_type: insight.actionType ?? null,
    action_payload: insight.actionPayload ?? {},
    status: "open",
    created_by: "system",
    updated_at: new Date().toISOString(),
  };
}

async function executeFlowTask(supabase: any, request: FlowTaskRequest, settings: any, opensquad: Omit<OpenSquadTaskRequest, "tenantId" | "userId">) {
  const decision = decideFlowTask(request);
  if (!decision.canExecute) throw new Error(decision.reason);
  if (!settings.ai_enabled && ["opensquad", "hybrid"].includes(decision.executionMode)) {
    throw new Error("Inteligencia desativada para este tenant.");
  }

  const monthStart = startOfMonthIso();
  const [{ data: usageRows }, { data: taskRows }] = await Promise.all([
    table(supabase, "ai_usage_logs").select("total_tokens").eq("tenant_id", request.tenantId).gte("created_at", monthStart),
    table(supabase, "flow_tasks").select("id").eq("tenant_id", request.tenantId).gte("created_at", monthStart),
  ]);
  const usedTokens = (usageRows ?? []).reduce((sum: number, row: any) => sum + Number(row.total_tokens ?? 0), 0);
  if (usedTokens >= Number(settings.monthly_token_limit ?? 0)) throw new Error("Limite mensal de uso de inteligencia atingido.");
  if ((taskRows?.length ?? 0) >= Number(settings.monthly_task_limit ?? 0)) throw new Error("Limite mensal de tarefas de inteligencia atingido.");

  const { data: task, error: taskError } = await table(supabase, "flow_tasks")
    .insert({
      tenant_id: request.tenantId,
      user_id: request.userId,
      module: request.module,
      task_type: request.taskType,
      input: request.input,
      execution_mode: decision.executionMode,
      status: "running",
      estimated_cost: decision.estimatedCost ?? 0,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (taskError) throw taskError;

  const inputHash = await hashInput(request.input);
  const cacheKey = `${request.module}:${request.taskType}`;
  const { data: cached } = await table(supabase, "ai_cache")
    .select("*")
    .eq("tenant_id", request.tenantId)
    .eq("cache_key", cacheKey)
    .eq("input_hash", inputHash)
    .maybeSingle();

  if (cached && (!cached.expires_at || cached.expires_at > new Date().toISOString())) {
    await table(supabase, "flow_tasks").update({
      output: cached.output,
      execution_mode: "cache",
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", task.id).eq("tenant_id", request.tenantId);
    await table(supabase, "ai_usage_logs").insert({
      tenant_id: request.tenantId,
      user_id: request.userId,
      flow_task_id: task.id,
      provider: "cache",
      model: "cache",
      task_type: request.taskType,
      module: request.module,
      total_tokens: 0,
      estimated_cost: 0,
      status: "cached",
    });
    return { output: cached.output, decision: { ...decision, executionMode: "cache" as const }, taskId: task.id, cached: true };
  }

  const result = await executeOpenSquadTask({
    ...opensquad,
    tenantId: request.tenantId,
    userId: request.userId,
  });

  const totalTokens = Number(result.tokensUsed ?? 0);
  await table(supabase, "flow_tasks").update({
    output: result.output,
    status: result.success ? "completed" : "failed",
    error: result.error ?? null,
    tokens_used: totalTokens,
    completed_at: new Date().toISOString(),
  }).eq("id", task.id).eq("tenant_id", request.tenantId);

  await table(supabase, "ai_usage_logs").insert({
    tenant_id: request.tenantId,
    user_id: request.userId,
    flow_task_id: task.id,
    provider: result.modelUsed === "local-fallback" ? "fallback" : "opensquad",
    model: result.modelUsed ?? "unknown",
    task_type: request.taskType,
    module: request.module,
    total_tokens: totalTokens,
    estimated_cost: roundMoney(totalTokens * 0.000002),
    execution_time_ms: result.executionTimeMs ?? null,
    status: result.success ? "completed" : "failed",
  });

  if (result.success) {
    await table(supabase, "ai_cache").upsert({
      tenant_id: request.tenantId,
      cache_key: cacheKey,
      task_type: request.taskType,
      input_hash: inputHash,
      output: result.output,
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "tenant_id,cache_key,input_hash" });
  }

  if (!result.success) throw new Error(result.error ?? "Falha ao executar tarefa de inteligencia.");
  return { output: result.output, decision, taskId: task.id, cached: false };
}

async function collectInactiveAudience(supabase: any, ownerId: string) {
  const fortyFiveAgo = daysAgoIso(45);
  const ninetyAgo = daysAgoIso(90);
  const [{ data: clientes }, { data: ordens }] = await Promise.all([
    supabase.from("clientes").select("id, nome, telefone, pontos_saldo").eq("owner_id", ownerId),
    supabase.from("ordens_servico").select("cliente_id, valor, created_at").eq("owner_id", ownerId).gte("created_at", ninetyAgo),
  ]);
  const lastVisit = new Map<string, string>();
  const totalByClient = new Map<string, number>();
  (ordens ?? []).forEach((row: any) => {
    if (!lastVisit.has(row.cliente_id) || lastVisit.get(row.cliente_id)! < row.created_at) lastVisit.set(row.cliente_id, row.created_at);
    totalByClient.set(row.cliente_id, (totalByClient.get(row.cliente_id) ?? 0) + Number(row.valor ?? 0));
  });
  const rows = (clientes ?? [])
    .map((c: any) => {
      const ultima = lastVisit.get(c.id);
      const dias = ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86_400_000) : 999;
      return { ...c, dias_inativo: dias, total: totalByClient.get(c.id) ?? 0 };
    })
    .filter((c: any) => c.telefone && (!lastVisit.get(c.id) || lastVisit.get(c.id)! < fortyFiveAgo))
    .sort((a: any, b: any) => b.total - a.total || b.dias_inativo - a.dias_inativo)
    .slice(0, 30);
  const ticketMedio = ordens?.length ? (ordens ?? []).reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0) / (ordens ?? []).length : 50;
  return {
    rows,
    summary: {
      total: rows.length,
      averageDaysInactive: rows.length ? Math.round(rows.reduce((sum: number, row: any) => sum + row.dias_inativo, 0) / rows.length) : 0,
      estimatedImpact: roundMoney(rows.length * ticketMedio),
      sampleNames: rows.slice(0, 5).map((r: any) => r.nome),
    },
  };
}

export const listIntelligenceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId, role } = await getOwnerScope(supabase, userId);
    assertTenantRole(role, GESTAO_ROLES);
    const settings = await ensureAISettings(supabase, ownerId);
    const monthStart = startOfMonthIso();
    const [{ data: insights }, { data: tasks }, { data: usage }] = await Promise.all([
      table(supabase, "business_insights").select("*").eq("tenant_id", ownerId).eq("status", "open").order("created_at", { ascending: false }).limit(20),
      table(supabase, "flow_tasks").select("*").eq("tenant_id", ownerId).order("created_at", { ascending: false }).limit(20),
      table(supabase, "ai_usage_logs").select("*").eq("tenant_id", ownerId).gte("created_at", monthStart).order("created_at", { ascending: false }).limit(200),
    ]);
    const usageRows = usage ?? [];
    return {
      settings,
      insights: insights ?? [],
      tasks: tasks ?? [],
      usage: {
        totalTasks: usageRows.length,
        totalTokens: usageRows.reduce((sum: number, row: any) => sum + Number(row.total_tokens ?? 0), 0),
        estimatedCost: roundMoney(usageRows.reduce((sum: number, row: any) => sum + Number(row.estimated_cost ?? 0), 0)),
        monthlyTokenLimit: Number(settings.monthly_token_limit ?? 0),
        monthlyTaskLimit: Number(settings.monthly_task_limit ?? 0),
        byModule: Object.values(usageRows.reduce((acc: Record<string, any>, row: any) => {
          const key = row.module ?? "outros";
          acc[key] ??= { module: key, tasks: 0, tokens: 0 };
          acc[key].tasks += 1;
          acc[key].tokens += Number(row.total_tokens ?? 0);
          return acc;
        }, {})),
      },
    };
  });

export const generateIntelligenceInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId, role } = await getOwnerScope(supabase, userId);
    assertTenantRole(role, GESTAO_ROLES);
    await ensureAISettings(supabase, ownerId);
    const metrics = await collectOperationalMetrics(supabase, ownerId);
    const insights = runBusinessRules(metrics);
    await table(supabase, "business_insights")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("tenant_id", ownerId)
      .eq("status", "open")
      .eq("created_by", "system");
    const { data, error } = await table(supabase, "business_insights")
      .insert(insights.map(mapInsightToRow))
      .select("*");
    if (error) throw error;
    return { insights: data ?? [], metrics };
  });

export const dismissBusinessInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
    assertTenantRole(role, GESTAO_ROLES);
    const { error } = await table(context.supabase, "business_insights")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("tenant_id", ownerId);
    if (error) throw error;
    return { ok: true };
  });

export const generateInactiveClientsCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId, role } = await getOwnerScope(supabase, userId);
    assertTenantRole(role, GESTAO_ROLES);
    const settings = await ensureAISettings(supabase, ownerId);
    const [businessContext, audience] = await Promise.all([
      getBusinessContext(supabase, ownerId, settings),
      collectInactiveAudience(supabase, ownerId),
    ]);
    const request: FlowTaskRequest = {
      tenantId: ownerId,
      userId,
      taskType: "generate_inactive_clients_campaign",
      module: "marketing",
      input: { audience: audience.summary, tone: settings.preferred_tone },
      priority: "normal",
      source: "manual_action",
    };
    const result = await executeFlowTask(supabase, request, settings, {
      squadKey: "marketing_campaign_squad",
      taskKey: "generate_inactive_clients_campaign",
      context: {
        businessContext,
        campaignGoal: "recuperar_clientes_inativos",
        audience: audience.summary,
        estimatedImpact: audience.summary.estimatedImpact,
        constraints: { language: "pt-BR", tone: settings.preferred_tone, maxLengthWhatsApp: 500 },
      },
      constraints: { language: "pt-BR", tone: settings.preferred_tone, outputFormat: "json", maxTokens: 900 },
    });
    const output = result.output ?? {};
    const { data: campanha, error } = await supabase.from("campanhas").insert({
      owner_id: ownerId,
      nome: output.campaignTitle ?? "Campanha de recuperacao",
      tipo: "inativos",
      canal: "whatsapp",
      status: "rascunho",
      mensagem: output.whatsappMessage ?? "Ola {{nome}}! Sentimos sua falta por aqui. Quer agendar um horario esta semana?",
      metadata: { source: "flow_engine", output, flow_task_id: result.taskId },
    }).select("id, nome, mensagem, tipo, status, metadata").single();
    if (error) throw error;
    if (audience.rows.length > 0) {
      await supabase.from("campanha_alvos").insert(audience.rows.map((row: any) => ({
        owner_id: ownerId,
        campanha_id: campanha.id,
        cliente_id: row.id,
        nome: row.nome,
        telefone: row.telefone,
        status: "pendente",
        metadata: { dias_inativo: row.dias_inativo, pontos: row.pontos_saldo },
      })));
    }
    return { campanha, output, audience: audience.summary, taskId: result.taskId, cached: result.cached };
  });

export const generateRevenueDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId, role } = await getOwnerScope(supabase, userId);
    assertTenantRole(role, GESTAO_ROLES);
    const settings = await ensureAISettings(supabase, ownerId);
    const [businessContext, metrics] = await Promise.all([
      getBusinessContext(supabase, ownerId, settings),
      collectOperationalMetrics(supabase, ownerId),
    ]);
    const request: FlowTaskRequest = {
      tenantId: ownerId,
      userId,
      taskType: "generate_revenue_diagnosis",
      module: "financeiro",
      input: { metrics },
      priority: "high",
      source: "manual_action",
    };
    const result = await executeFlowTask(supabase, request, settings, {
      squadKey: "revenue_diagnosis_squad",
      taskKey: "generate_revenue_diagnosis",
      context: { businessContext, metrics },
      constraints: { language: "pt-BR", tone: settings.preferred_tone, outputFormat: "json", maxTokens: 1000 },
    });
    return { diagnosis: result.output, metrics, taskId: result.taskId, cached: result.cached };
  });

export const generateDailySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId, role } = await getOwnerScope(supabase, userId);
    assertTenantRole(role, GESTAO_ROLES);
    const settings = await ensureAISettings(supabase, ownerId);
    const [businessContext, metrics] = await Promise.all([
      getBusinessContext(supabase, ownerId, settings),
      collectOperationalMetrics(supabase, ownerId),
    ]);
    const request: FlowTaskRequest = {
      tenantId: ownerId,
      userId,
      taskType: "generate_daily_summary",
      module: "operacao",
      input: { date: todayIso(), metrics },
      priority: "normal",
      source: "manual_action",
    };
    const result = await executeFlowTask(supabase, request, settings, {
      squadKey: "daily_summary_squad",
      taskKey: "generate_daily_summary",
      context: { businessContext, dailyMetrics: metrics },
      constraints: { language: "pt-BR", tone: settings.preferred_tone, outputFormat: "json", maxTokens: 700 },
    });
    return { summary: result.output, metrics, taskId: result.taskId, cached: result.cached };
  });

export const updateTenantAISettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    ai_enabled: z.boolean(),
    monthly_token_limit: z.number().int().min(1000).max(5_000_000),
    monthly_task_limit: z.number().int().min(1).max(10000),
    auto_insights_enabled: z.boolean(),
    auto_execute_enabled: z.boolean(),
    preferred_tone: z.string().min(3).max(80),
    business_context: z.record(z.any()).default({}),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
    assertTenantRole(role, ADMIN_ROLES);
    const { data: settings, error } = await table(context.supabase, "tenant_ai_settings").upsert({
      tenant_id: ownerId,
      ...data,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id" }).select("*").single();
    if (error) throw error;
    return { settings };
  });
