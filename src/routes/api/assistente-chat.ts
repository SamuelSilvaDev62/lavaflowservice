import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildBusinessContext, resolveOwnerScope } from "@/lib/ai/lavaflow-context";
import { buildRulesConsultorResponse, LAVAFLOW_CONSULTOR_SYSTEM_PROMPT, runConsultor } from "@/lib/ai/lavaflow-consultor";
import { createOpenAIProvider, getOpenAIModel, hasOpenAIConfig } from "@/lib/ai/openai";

const RATE_LIMIT_MESSAGE = "Voce atingiu o limite temporario de consultas do Consultor LavaFlow IA. Tente novamente mais tarde.";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function createAuthedSupabase(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: new Response("Unauthorized", { status: 401 }) };

  const token = authHeader.slice(7);
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { error: new Response("Missing Supabase server configuration", { status: 500 }) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return { error: new Response("Unauthorized", { status: 401 }) };

  const userId = userData.user.id;
  const { ownerId, role } = await resolveOwnerScope(supabase, userId);
  // SECURITY: users without an assigned role on a tenant get no access (no self-tenant fallback).
  if (!ownerId || !role || !["owner", "admin", "gerente"].includes(role)) {
    return { error: new Response("Forbidden", { status: 403 }) };
  }

  return { supabase, userId, ownerId: ownerId as string, role: role as string };
}

async function checkRateLimit(_supabase: any, ownerId: string) {
  // SECURITY: count via service-role client so RLS on ai_usage_logs cannot mask usage
  // (the SELECT policy requires owner/admin role; counting through the user client
  // would silently return 0 for non-owner/admin callers and bypass the limit).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [{ count: hourly }, { count: daily }] = await Promise.all([
    supabaseAdmin.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).gte("created_at", hourAgo),
    supabaseAdmin.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).gte("created_at", dayAgo),
  ]);

  return Number(hourly ?? 0) < 30 && Number(daily ?? 0) < 300;
}


async function logUsage(supabase: any, input: {
  ownerId: string;
  userId: string;
  route: string;
  tokensInput?: number;
  tokensOutput?: number;
}) {
  await supabase.from("ai_usage_logs").insert({
    owner_id: input.ownerId,
    user_id: input.userId,
    route: input.route,
    tokens_input: input.tokensInput ?? 0,
    tokens_output: input.tokensOutput ?? 0,
    estimated_cost: 0,
  });
}

async function saveRecommendations(supabase: any, ownerId: string, userId: string, recommendations: any[]) {
  const rows = recommendations.map((item) => ({
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
  if (rows.length > 0) await supabase.from("ai_recommendations").insert(rows);
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
          let payload;
          let tokensInput = 0;
          let tokensOutput = 0;

          if (hasOpenAIConfig()) {
            try {
              const result = await runConsultor({ context });
              payload = result.data;
              tokensInput = result.usage.inputTokens;
              tokensOutput = result.usage.outputTokens;
            } catch (error) {
              console.warn("[consultor-ia] fallback", error);
              payload = buildRulesConsultorResponse(context, true);
            }
          } else {
            payload = buildRulesConsultorResponse(context, true);
          }

          await Promise.all([
            logUsage(supabase, { ownerId, userId, route: "/api/assistente-chat:GET", tokensInput, tokensOutput }),
            saveRecommendations(supabase, ownerId, userId, payload.topOpportunities ?? []),
          ]);

          return json({
            ...payload,
            contextMetrics: context.metrics,
            contextInfluence: {
              total: context.opportunities?.receita_influenciada_total ?? 0,
              percentual: context.opportunities?.receita_influenciada_percentual ?? 0,
              porOrigem: context.opportunities?.receita_influenciada_por_origem ?? [],
            },
          });
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
          if (!Array.isArray(messages)) return new Response("Bad request", { status: 400 });

          const context = await buildBusinessContext(supabase, ownerId, "30d");
          const empresa = context.business?.nome_empresa ?? "lava-rapido";
          const metrics = context.metrics ?? {};
          const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const systemPrompt = `${LAVAFLOW_CONSULTOR_SYSTEM_PROMPT}

CONTEXTO AGREGADO DO NEGOCIO:
${JSON.stringify(context)}

INSTRUCOES PARA O CHAT:
- Responda em portugues brasileiro, com markdown curto.
- Use apenas numeros do contexto agregado ou das ferramentas server-side.
- Se nao houver dados suficientes, diga: "Ainda nao tenho dados suficientes para uma analise confiavel. Recomendo registrar mais ordens de servico e clientes para melhorar minhas recomendacoes."
- Nao exponha IDs internos, tokens, chaves ou telefone completo.

Resumo rapido: ${empresa}; receita do periodo ${fmt(Number(metrics.receita_periodo ?? 0))}; ticket medio ${fmt(Number(metrics.ticket_medio ?? 0))}; clientes inativos ${metrics.clientes_inativos ?? 0}; MRR ${fmt(Number(metrics.mrr ?? 0))}.`;

          const openaiProvider = createOpenAIProvider();
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          const model = openaiProvider
            ? openaiProvider(getOpenAIModel())
            : LOVABLE_API_KEY
              ? createLovableAiGatewayProvider(LOVABLE_API_KEY)("google/gemini-3-flash-preview")
              : null;

          if (!model) {
            const fallback = buildRulesConsultorResponse(context, true);
            return json({
              messages,
              error: fallback.fallbackNotice,
              answer: fallback.summary,
            }, { status: 503 });
          }

          await logUsage(supabase, { ownerId, userId, route: "/api/assistente-chat:POST" });

          const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
          const result = streamText({
            model,
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
            stopWhen: stepCountIs(50),
            tools: {
              listar_clientes_inativos: tool({
                description: "Lista clientes sem visita ha N dias. Retorna nome e dados agregados, sem telefone.",
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
                description: "Top N clientes que mais gastaram nos ultimos 90 dias, sem telefone.",
                inputSchema: z.object({ limit: z.number().int().min(3).max(20).default(10) }),
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
                  return { top: Array.from(totals.values()).sort((a, b) => b.total - a.total).slice(0, limit) };
                },
              }),
              analise_dia_semana: tool({
                description: "Receita por dia da semana nos ultimos 90 dias.",
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
                  return { por_dia: labels.map((label, index) => ({ dia: label, receita: Math.round(por[index] * 100) / 100 })) };
                },
              }),
              top_servicos: tool({
                description: "Servicos que mais geraram receita nos ultimos 90 dias.",
                inputSchema: z.object({}),
                execute: async () => {
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
                  return { servicos: Array.from(por, ([nome, value]) => ({ nome, ...value })).sort((a, b) => b.receita - a.receita).slice(0, 10) };
                },
              }),
              gerar_mensagem_whatsapp: tool({
                description: "Gera uma mensagem curta e editavel de WhatsApp.",
                inputSchema: z.object({
                  objetivo: z.enum(["reativacao", "promocao", "lembrete_assinatura", "agradecimento", "recompensa_disponivel", "proximo_recompensa"]),
                  contexto_extra: z.string().max(300).optional(),
                }),
                execute: async ({ objetivo, contexto_extra }) => ({
                  objetivo,
                  mensagem_base: objetivo === "recompensa_disponivel"
                    ? "Ola {nome}! Boa noticia: voce ja possui pontos suficientes para resgatar {recompensa}. Esperamos voce para aproveitar seu beneficio."
                    : objetivo === "proximo_recompensa"
                      ? "Ola {nome}! Voce esta muito perto de desbloquear uma recompensa no nosso programa de fidelidade. Que tal agendar sua proxima lavagem?"
                      : "Ola {nome}! Sentimos sua falta por aqui. Faz um tempo desde sua ultima visita e queremos te convidar para cuidar do seu veiculo novamente. Esta semana temos uma condicao especial para voce.",
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
