// Contexto de negócio para o Consultor IA (server-only).
// Não há tabelas de log de IA neste projeto: rate limit é em memória por worker.
export type ConsultorContexto = {
  empresa: string;
  periodo: string;
  receita30d: number;
  osEntregues30d: number;
  ticketMedio: number;
  clientesTotal: number;
  clientesInativos60d: number;
  agendamentosProximos7d: number;
  topServicos: Array<{ nome: string; quantidade: number; receita: number }>;
  ocupacaoMediaDia: number;
};

const DIA = 86_400_000;

export async function buildConsultorContexto(ownerId: string): Promise<ConsultorContexto> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const desde30 = new Date(Date.now() - 30 * DIA).toISOString();
  const desde60 = new Date(Date.now() - 60 * DIA).toISOString();
  const hoje = new Date().toISOString();
  const daqui7 = new Date(Date.now() + 7 * DIA).toISOString();

  const [empresaRes, osRes, clientesRes, agRes, servicosRes] = await Promise.all([
    supabaseAdmin.from("empresa").select("nome_fantasia").eq("owner_id", ownerId).maybeSingle(),
    supabaseAdmin
      .from("ordens_servico")
      .select("id, valor, status, servico_id, cliente_id, created_at")
      .eq("owner_id", ownerId)
      .gte("created_at", desde30),
    supabaseAdmin.from("clientes").select("id, created_at").eq("owner_id", ownerId),
    supabaseAdmin
      .from("agendamentos")
      .select("id, data_hora")
      .eq("owner_id", ownerId)
      .gte("data_hora", hoje)
      .lte("data_hora", daqui7),
    supabaseAdmin.from("servicos").select("id, nome").eq("owner_id", ownerId),
  ]);

  const os = (osRes.data ?? []) as any[];
  const entregues = os.filter((o) => o.status === "entregue");
  const receita = entregues.reduce((s, o) => s + Number(o.valor ?? 0), 0);
  const nomes = new Map<string, string>(
    ((servicosRes.data ?? []) as any[]).map((s) => [s.id, s.nome as string]),
  );

  const porServico = new Map<string, { nome: string; quantidade: number; receita: number }>();
  for (const o of entregues) {
    const key = String(o.servico_id ?? "outros");
    const atual = porServico.get(key) ?? {
      nome: nomes.get(key) ?? "Outros",
      quantidade: 0,
      receita: 0,
    };
    atual.quantidade += 1;
    atual.receita += Number(o.valor ?? 0);
    porServico.set(key, atual);
  }

  // Clientes sem OS nos últimos 60 dias.
  const { data: osRecentes } = await supabaseAdmin
    .from("ordens_servico")
    .select("cliente_id")
    .eq("owner_id", ownerId)
    .gte("created_at", desde60);
  const ativos = new Set(((osRecentes ?? []) as any[]).map((o) => String(o.cliente_id)));
  const clientes = (clientesRes.data ?? []) as any[];

  return {
    empresa: (empresaRes.data as any)?.nome_fantasia ?? "Seu lava-rápido",
    periodo: "últimos 30 dias",
    receita30d: Math.round(receita * 100) / 100,
    osEntregues30d: entregues.length,
    ticketMedio: entregues.length ? Math.round((receita / entregues.length) * 100) / 100 : 0,
    clientesTotal: clientes.length,
    clientesInativos60d: clientes.filter((c) => !ativos.has(String(c.id))).length,
    agendamentosProximos7d: (agRes.data ?? []).length,
    topServicos: [...porServico.values()].sort((a, b) => b.receita - a.receita).slice(0, 5),
    ocupacaoMediaDia: Math.round(((entregues.length / 30) + Number.EPSILON) * 10) / 10,
  };
}

/** Prompt de sistema do consultor, sempre com dados reais do tenant. */
export function consultorSystemPrompt(ctx: ConsultorContexto) {
  const semDados =
    ctx.osEntregues30d === 0 && ctx.clientesTotal === 0 && ctx.agendamentosProximos7d === 0;

  return [
    "Você é o Consultor de Crescimento do LavaFlow, especialista em operação de lava-rápidos no Brasil.",
    "Responda em português do Brasil, de forma direta, prática e acionável. Use no máximo 200 palavras.",
    "REGRAS OBRIGATÓRIAS:",
    "1. Responda especificamente à pergunta feita — nunca repita uma resposta genérica ou o mesmo texto de outra pergunta.",
    "2. Cite ao menos dois números reais dos DADOS abaixo (receita, ticket médio, clientes inativos, serviços, agendamentos) e explique o que eles indicam.",
    "3. Nunca invente números, nomes de serviços ou clientes. Se o dado necessário não existir nos DADOS, diga claramente que falta esse dado e o que precisa ser registrado no LavaFlow para responder.",
    "4. Termine com uma lista curta de ações concretas (hoje / esta semana).",
    semDados
      ? "5. Este estabelecimento ainda não possui histórico registrado: seja transparente sobre isso e foque em quais registros iniciar."
      : "5. Adapte o tom e o foco ao tema da pergunta (faturamento, serviços, clientes, agenda).",
    "",
    "DADOS DO ESTABELECIMENTO (fonte única de verdade):",
    JSON.stringify(ctx, null, 2),
  ].join("\n");
}

// ---- Rate limit simples em memória (por worker) ----
const buckets = new Map<string, { count: number; resetAt: number }>();
const LIMITE_HORA = 30;

export function checkAiRateLimit(ownerId: string) {
  const now = Date.now();
  const b = buckets.get(ownerId);
  if (!b || b.resetAt < now) {
    buckets.set(ownerId, { count: 1, resetAt: now + 3_600_000 });
    return { ok: true as const, restante: LIMITE_HORA - 1 };
  }
  if (b.count >= LIMITE_HORA) {
    return { ok: false as const, restante: 0, resetAt: b.resetAt };
  }
  b.count += 1;
  return { ok: true as const, restante: LIMITE_HORA - b.count };
}
