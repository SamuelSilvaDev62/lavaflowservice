import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildBusinessContext, resolveOwnerScope } from "@/lib/ai/lavaflow-context";
import { buildRulesConsultorResponse, LAVAFLOW_CONSULTOR_SYSTEM_PROMPT } from "@/lib/ai/lavaflow-consultor";
import { canUseFeature, getEntitlement, type PlanId } from "@/lib/plans";

const RATE_LIMIT_MESSAGE = "Voce atingiu o limite temporario de consultas do Consultor LavaFlow IA. Tente novamente mais tarde.";
const AI_NOT_CONFIGURED = "O Lovable AI ainda nao esta disponivel neste ambiente.";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function createAuthedSupabase(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: json({ error: "Unauthorized" }, { status: 401 }) };

  const token = authHeader.slice(7);
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { error: json({ error: "Missing Supabase server configuration" }, { status: 500 }) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return { error: json({ error: "Unauthorized" }, { status: 401 }) };

  const userId = userData.user.id;
  const { ownerId, role } = await resolveOwnerScope(supabase, userId);
  if (!["owner", "admin", "gerente"].includes(role)) {
    return { error: json({ error: "Sem permissao para usar o Consultor IA." }, { status: 403 }) };
  }

  const { data: subscriptionRows, error: subscriptionError } = await (supabase as any).rpc("get_my_subscription");
  if (subscriptionError) {
    console.error("[assistente-entitlement]", subscriptionError);
    return { error: json({ error: "Nao foi possivel verificar o plano atual." }, { status: 503 }) };
  }
  const row = Array.isArray(subscriptionRows) ? subscriptionRows[0] : subscriptionRows;
  const entitlement = getEntitlement(
    row
      ? {
          plan: (row.plan ?? null) as PlanId | null,
          subscription_status: row.subscription_status ?? null,
          is_founders: !!row.is_founders,
          stripe_price_id: row.stripe_price_id ?? null,
          current_period_end: row.current_period_end ?? null,
          trial_ends_at: row.trial_ends_at ?? null,
          cancel_at_period_end: !!row.cancel_at_period_end,
          has_customer: !!row.has_customer,
        }
      : null,
  );
  if (!canUseFeature(entitlement, "ai_assistant")) {
    return {
      error: json(
        { error: "O Consultor com IA e exclusivo do plano Intelligence.", requiredPlan: "intelligence" },
        { status: 403 },
      ),
    };
  }

  return { supabase, userId, ownerId, role, entitlement };
}

async function checkRateLimit(supabase: any, ownerId: string) {
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [{ count: hourly }, { count: daily }] = await Promise.all([
    supabase.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).gte("created_at", hourAgo),
    supabase.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).gte("created_at", dayAgo),
  ]);

  return Number(hourly ?? 0) < 30 && Number(daily ?? 0) < 300;
}

async function logUsage(supabase: any, input: { ownerId: string; userId: string; route: string }) {
  const { error } = await supabase.from("ai_usage_logs").insert({
    owner_id: input.ownerId,
    user_id: input.userId,
    route: input.route,
    tokens_input: 0,
    tokens_output: 0,
    estimated_cost: 0,
  });
  if (error) console.warn("[assistente-usage-log]", error.message ?? error);
}

async function saveRecommendations(supabase: any, ownerId: string, userId: string, recommendations: any[]) {
  const rows = recommendations.slice(0, 6).map((item) => ({
    owner_id: ownerId,
    user_id: userId,
    type: item.category,
    priority: item.priority,
    title: item.title,
    description: item.description,
    estimated_impact: item.estimatedImpact,
    payload: item,
    status: "nova",
  }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("ai_recommendations").insert(rows);
  if (error) console.warn("[assistente-recommendations]", error.message ?? error);
}

export const Route = createFileRoute("/api/assistente-chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = await createAuthedSupabase(request);
          if ("error" in auth) return auth.error;
          const { supabase, userId, ownerId } = auth;
          const url = new URL(request.url);
          const period = url.searchParams.get("period") ?? "30d";

          const allowed = await checkRateLimit(supabase, ownerId);
          if (!allowed) return json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });

          const context = await buildBusinessContext(supabase, ownerId, period);
          const payload = buildRulesConsultorResponse(context);

          await Promise.all([
            logUsage(supabase, { ownerId, userId, route: "/api/assistente-chat:GET" }),
            saveRecommendations(supabase, ownerId, userId, payload.topOpportunities),
          ]);

          return json({ ...payload, contextMetrics: context.metrics });
        } catch (err) {
          console.error("[assistente-consultor]", err);
          return json({ error: "Nao foi possivel carregar o Consultor LavaFlow IA." }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          const auth = await createAuthedSupabase(request);
          if ("error" in auth) return auth.error;
          const { supabase, userId, ownerId } = auth;

          const allowed = await checkRateLimit(supabase, ownerId);
          if (!allowed) return json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });

          const body = (await request.json()) as { messages?: UIMessage[] };
          const messages = body.messages;
          if (!Array.isArray(messages)) return json({ error: "Bad request" }, { status: 400 });

          const context = await buildBusinessContext(supabase, ownerId, "30d");
          const metrics = context.metrics ?? {};
          const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const systemPrompt = `${LAVAFLOW_CONSULTOR_SYSTEM_PROMPT}\n\nCONTEXTO AGREGADO DO NEGOCIO:\n${JSON.stringify(context)}\n\nINSTRUCOES PARA O CHAT:\n- Responda em portugues brasileiro, com markdown curto e acionavel.\n- Quando recomendar algo, diga por que e qual seria o proximo passo.\n- Use ferramentas quando precisar detalhar clientes, servicos ou dias da semana.\n- Nao exponha IDs internos, tokens, chaves ou telefone completo.\n- Se os dados forem insuficientes, diga isso claramente.\n\nResumo: receita do periodo ${fmt(Number(metrics.receita_periodo ?? 0))}; ticket medio ${fmt(Number(metrics.ticket_medio ?? 0))}; clientes inativos ${metrics.clientes_inativos ?? 0}; MRR ${fmt(Number(metrics.mrr ?? 0))}.`;

          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY?.trim();
          if (!LOVABLE_API_KEY) return json({ error: AI_NOT_CONFIGURED }, { status: 503 });

          const modelName = process.env.LOVABLE_AI_MODEL?.trim() || "google/gemini-3-flash-preview";
          const model = createLovableAiGatewayProvider(LOVABLE_API_KEY)(modelName);
          await logUsage(supabase, { ownerId, userId, route: "/api/assistente-chat:POST" });

          const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
          const result = streamText({
            model,
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
            stopWhen: stepCountIs(8),
            tools: {
              listar_clientes_inativos: tool({
                description: "Lista clientes sem visita ha N dias. Nao retorna telefone nem IDs.",
                inputSchema: z.object({ dias: z.number().int().min(7).max(365).default(60) }),
                execute: async ({ dias }) => {
                  const [{ data: clientes }, { data: ordens }] = await Promise.all([
                    supabase.from("clientes").select("id, nome, pontos_saldo").eq("owner_id", ownerId),
                    supabase.from("ordens_servico").select("cliente_id, created_at, valor").eq("owner_id", ownerId),
                  ]);
                  const last = new Map<string, { data: string; total: number }>();
                  (ordens ?? []).forEach((o: any) => {
                    const cur = last.get(o.cliente_id) ?? { data: o.created_at, total: 0 };
                    if (cur.data < o.created_at) cur.data = o.created_at;
                    cur.total += Number(o.valor ?? 0);
                    last.set(o.cliente_id, cur);
                  });
                  const limit = Date.now() - dias * 86_400_000;
                  const inativos = (clientes ?? [])
                    .map((c: any) => ({ ...c, ultima: last.get(c.id)?.data, total_gasto: last.get(c.id)?.total ?? 0 }))
                    .filter((c: any) => !c.ultima || new Date(c.ultima).getTime() < limit)
                    .sort((a: any, b: any) => b.total_gasto - a.total_gasto)
                    .slice(0, 20)
                    .map((c: any) => ({
                      nome: c.nome,
                      dias_sem_voltar: c.ultima ? Math.floor((Date.now() - new Date(c.ultima).getTime()) / 86_400_000) : null,
                      total_gasto: Math.round(c.total_gasto * 100) / 100,
                      pontos: Number(c.pontos_saldo ?? 0),
                    }));
                  return { total: inativos.length, clientes: inativos };
                },
              }),

              top_clientes: tool({
                description: "Mostra os clientes que mais geraram receita nos ultimos 90 dias, sem telefone nem IDs.",
                inputSchema: z.object({ limit: z.number().int().min(3).max(15).default(8) }),
                execute: async ({ limit }) => {
                  const { data } = await supabase
                    .from("ordens_servico")
                    .select("cliente_id, valor, clientes:cliente_id(nome)")
                    .eq("owner_id", ownerId)
                    .gte("created_at", ninetyAgo);
                  const totals = new Map<string, { nome: string; total: number; visitas: number }>();
                  (data ?? []).forEach((o: any) => {
                    const key = o.cliente_id;
                    const cur = totals.get(key) ?? { nome: o.clientes?.nome ?? "Cliente", total: 0, visitas: 0 };
                    cur.total += Number(o.valor ?? 0);
                    cur.visitas += 1;
                    totals.set(key, cur);
                  });
                  return {
                    top: Array.from(totals.values())
                      .sort((a, b) => b.total - a.total)
                      .slice(0, limit)
                      .map((item) => ({ ...item, total: Math.round(item.total * 100) / 100 })),
                  };
                },
              }),

              analise_dia_semana: tool({
                description: "Calcula receita por dia da semana nos ultimos 90 dias.",
                inputSchema: z.object({}),
                execute: async () => {
                  const { data } = await supabase
                    .from("ordens_servico")
                    .select("valor, created_at")
                    .eq("owner_id", ownerId)
                    .gte("created_at", ninetyAgo);
                  const labels = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
                  const por = Array(7).fill(0);
                  (data ?? []).forEach((o: any) => {
                    por[new Date(o.created_at).getDay()] += Number(o.valor ?? 0);
                  });
                  return { por_dia: labels.map((dia, index) => ({ dia, receita: Math.round(por[index] * 100) / 100 })) };
                },
              }),

              top_servicos: tool({
                description: "Mostra os servicos que mais geraram receita nos ultimos 90 dias.",
                inputSchema: z.object({ limit: z.number().int().min(3).max(10).default(6) }),
                execute: async ({ limit }) => {
                  const { data } = await supabase
                    .from("ordens_servico")
                    .select("valor, servicos:servico_id(nome)")
                    .eq("owner_id", ownerId)
                    .gte("created_at", ninetyAgo);
                  const por = new Map<string, { receita: number; qtd: number }>();
                  (data ?? []).forEach((o: any) => {
                    const nome = o.servicos?.nome ?? "Sem servico";
                    const cur = por.get(nome) ?? { receita: 0, qtd: 0 };
                    cur.receita += Number(o.valor ?? 0);
                    cur.qtd += 1;
                    por.set(nome, cur);
                  });
                  return {
                    servicos: Array.from(por, ([nome, value]) => ({ nome, ...value }))
                      .sort((a, b) => b.receita - a.receita)
                      .slice(0, limit),
                  };
                },
              }),

              gerar_mensagem_whatsapp: tool({
                description: "Prepara uma mensagem curta e editavel de WhatsApp para uma acao comercial.",
                inputSchema: z.object({
                  objetivo: z.enum(["reativacao", "promocao", "assinatura", "agradecimento", "recompensa"]),
                  contexto_extra: z.string().max(300).optional(),
                }),
                execute: async ({ objetivo, contexto_extra }) => ({
                  objetivo,
                  orientacao: "Crie uma mensagem curta, humana, sem prometer resultado e mantendo placeholders como {nome} quando necessario.",
                  contexto_extra: contexto_extra ?? null,
                }),
              }),
            },
          });

          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (err) {
          console.error("[assistente-chat]", err);
          return json({ error: "Erro ao processar o Consultor LavaFlow IA." }, { status: 500 });
        }
      },
    },
  },
});
