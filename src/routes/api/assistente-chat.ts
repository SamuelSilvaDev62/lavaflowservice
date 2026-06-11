import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/assistente-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const token = authHeader.slice(7);

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          });

          const { data: userData, error: userErr } = await supabase.auth.getUser(token);
          if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
          const userId = userData.user.id;

          const body = (await request.json()) as { messages?: UIMessage[] };
          const messages = body.messages;
          if (!Array.isArray(messages)) return new Response("Bad request", { status: 400 });

          // Coletar contexto resumido do negócio para o system prompt
          const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
          const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

          const [{ data: empresa }, { data: ordensMes }, { data: clientesCount }, { data: assinaturas }] = await Promise.all([
            supabase.from("empresa").select("nome_fantasia, whatsapp").eq("owner_id", userId).maybeSingle(),
            supabase.from("ordens_servico").select("valor, status, created_at").eq("owner_id", userId).gte("created_at", startMonth),
            supabase.from("clientes").select("id", { count: "exact", head: true }).eq("owner_id", userId),
            supabase.from("assinaturas_clientes").select("id, planos_assinatura:plano_id(valor_mensal)").eq("owner_id", userId).eq("status", "ativa"),
          ]);

          const faturamentoMes = (ordensMes ?? []).reduce((s, o: any) => s + Number(o.valor ?? 0), 0);
          const lavagensMes = (ordensMes ?? []).length;
          const ticket = lavagensMes ? faturamentoMes / lavagensMes : 0;
          const mrr = (assinaturas ?? []).reduce((s, a: any) => s + Number(a.planos_assinatura?.valor_mensal ?? 0), 0);
          const totalClientes = (clientesCount as any)?.count ?? 0;
          const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

          const systemPrompt = `Você é o Assistente de Crescimento da ${empresa?.nome_fantasia ?? "lava-rápido"}, um consultor de negócios especializado em lava-rápidos brasileiros. Fale em português brasileiro, com tom direto, prático e amigável. Use markdown (listas, negrito) para clareza.

CONTEXTO ATUAL DO NEGÓCIO:
- Faturamento do mês: ${fmt(faturamentoMes)} em ${lavagensMes} lavagens
- Ticket médio: ${fmt(ticket)}
- MRR (assinaturas ativas): ${fmt(mrr)}
- Total de clientes cadastrados: ${totalClientes}
- Data de hoje: ${new Date().toLocaleDateString("pt-BR")}

SUAS CAPACIDADES (use as ferramentas quando relevante):
- listar_clientes_inativos: clientes sem visita há N dias
- top_clientes: clientes que mais gastaram nos últimos 90d
- analise_dia_semana: receita por dia da semana
- top_servicos: serviços que mais geram receita
- gerar_mensagem_whatsapp: redigir mensagem persuasiva personalizada

REGRAS:
- Sempre cite números concretos quando responder.
- Sugira AÇÕES executáveis (não apenas insights).
- Se o usuário pedir para "enviar WhatsApp", primeiro use gerar_mensagem_whatsapp e mostre a mensagem; a execução real é manual via a tela /oportunidades.
- Seja conciso: máximo 4-5 linhas por resposta, a menos que seja pedido relatório completo.`;

          const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);

          const result = streamText({
            model: gateway("google/gemini-3-flash-preview"),
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
            stopWhen: stepCountIs(50),
            tools: {
              listar_clientes_inativos: tool({
                description: "Lista clientes sem visita há N dias. Use quando o usuário pedir clientes inativos, sumidos, para reativar.",
                inputSchema: z.object({ dias: z.number().int().min(7).max(365).default(60) }),
                execute: async ({ dias }) => {
                  const [{ data: clientes }, { data: ordens }] = await Promise.all([
                    supabase.from("clientes").select("id, nome, telefone").eq("owner_id", userId),
                    supabase.from("ordens_servico").select("cliente_id, created_at").eq("owner_id", userId),
                  ]);
                  const last = new Map<string, string>();
                  (ordens ?? []).forEach((o: any) => {
                    if (!last.has(o.cliente_id) || last.get(o.cliente_id)! < o.created_at) last.set(o.cliente_id, o.created_at);
                  });
                  const limit = Date.now() - dias * 86_400_000;
                  const inativos = (clientes ?? [])
                    .map((c: any) => ({ ...c, ultima: last.get(c.id) }))
                    .filter((c) => !c.ultima || new Date(c.ultima).getTime() < limit)
                    .slice(0, 20)
                    .map((c) => ({
                      nome: c.nome,
                      telefone: c.telefone,
                      dias_sem_voltar: c.ultima ? Math.floor((Date.now() - new Date(c.ultima).getTime()) / 86_400_000) : null,
                    }));
                  return { total: inativos.length, clientes: inativos };
                },
              }),
              top_clientes: tool({
                description: "Top N clientes que mais gastaram nos últimos 90 dias.",
                inputSchema: z.object({ limit: z.number().int().min(3).max(20).default(10) }),
                execute: async ({ limit }) => {
                  const { data } = await supabase
                    .from("ordens_servico")
                    .select("cliente_id, valor, clientes:cliente_id(nome)")
                    .eq("owner_id", userId)
                    .gte("created_at", ninetyAgo);
                  const totals = new Map<string, { nome: string; total: number; visitas: number }>();
                  (data ?? []).forEach((o: any) => {
                    const k = o.cliente_id;
                    const cur = totals.get(k) ?? { nome: o.clientes?.nome ?? "—", total: 0, visitas: 0 };
                    cur.total += Number(o.valor ?? 0);
                    cur.visitas += 1;
                    totals.set(k, cur);
                  });
                  return {
                    top: Array.from(totals.values()).sort((a, b) => b.total - a.total).slice(0, limit),
                  };
                },
              }),
              analise_dia_semana: tool({
                description: "Receita por dia da semana nos últimos 90 dias. Útil para sugerir dias para promoções.",
                inputSchema: z.object({}),
                execute: async () => {
                  const { data } = await supabase
                    .from("ordens_servico")
                    .select("valor, created_at")
                    .eq("owner_id", userId)
                    .gte("created_at", ninetyAgo);
                  const labels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
                  const por = Array(7).fill(0);
                  (data ?? []).forEach((o: any) => {
                    por[new Date(o.created_at).getDay()] += Number(o.valor ?? 0);
                  });
                  return { por_dia: labels.map((l, i) => ({ dia: l, receita: Math.round(por[i] * 100) / 100 })) };
                },
              }),
              top_servicos: tool({
                description: "Serviços que mais geraram receita nos últimos 90 dias.",
                inputSchema: z.object({}),
                execute: async () => {
                  const { data } = await supabase
                    .from("ordens_servico")
                    .select("valor, servicos:servico_id(nome)")
                    .eq("owner_id", userId)
                    .gte("created_at", ninetyAgo);
                  const por = new Map<string, { receita: number; qtd: number }>();
                  (data ?? []).forEach((o: any) => {
                    const n = o.servicos?.nome ?? "—";
                    const cur = por.get(n) ?? { receita: 0, qtd: 0 };
                    cur.receita += Number(o.valor ?? 0);
                    cur.qtd += 1;
                    por.set(n, cur);
                  });
                  return {
                    servicos: Array.from(por, ([nome, v]) => ({ nome, ...v })).sort((a, b) => b.receita - a.receita).slice(0, 10),
                  };
                },
              }),
              gerar_mensagem_whatsapp: tool({
                description: "Gera uma mensagem de WhatsApp persuasiva, curta e personalizada. Use quando o usuário pedir para redigir uma promoção, lembrete, reativação ou convite.",
                inputSchema: z.object({
                  objetivo: z.enum(["reativacao", "promocao", "lembrete_assinatura", "agradecimento"]),
                  contexto_extra: z.string().max(300).optional(),
                }),
                execute: async ({ objetivo, contexto_extra }) => {
                  return {
                    objetivo,
                    instrucao: `Redija agora a mensagem (use {nome} como placeholder do cliente). Objetivo: ${objetivo}. Contexto adicional: ${contexto_extra ?? "nenhum"}. Mantenha ≤ 320 caracteres, emoji moderado, tom brasileiro amigável, CTA claro. Empresa: ${empresa?.nome_fantasia ?? "Lava-Rápido"}.`,
                  };
                },
              }),
            },
          });

          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (err) {
          console.error("[assistente-chat]", err);
          return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
