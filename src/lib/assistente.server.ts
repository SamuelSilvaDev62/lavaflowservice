import {
  businessContextCompleteness,
  mergeEmpresaIntoContext,
  type BusinessContext,
} from "@/lib/business-context";
import { buildSkillContext } from "@/lib/skill-context";

// Contexto de negócio para o Consultor IA (server-only).
// Access limits are durable PostgreSQL counters, applied by the chat handler.
export type ConsultorContexto = {
  empresa: string;
  identidade: {
    nomeFantasia: string | null;
    endereco: string | null;
    horarioFuncionamento: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    website: string | null;
    tomDeVoz: string | null;
    contexto: BusinessContext;
    completude: number;
  };
  servicosAtivos: Array<{
    nome: string;
    preco: number;
    categoria: string | null;
    descricao: string | null;
    tempoMin: number | null;
  }>;
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

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function assertOk(label: string, error: { message?: string } | null) {
  if (error) {
    console.error("[consultor] falha ao carregar contexto", { fonte: label });
    throw new Error(`Contexto do consultor indisponível (${label}).`);
  }
}

export async function buildConsultorContexto(ownerId: string): Promise<ConsultorContexto> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const desde30 = new Date(Date.now() - 30 * DIA).toISOString();
  const desde60 = new Date(Date.now() - 60 * DIA).toISOString();
  const hoje = ymd(new Date());
  const daqui7 = ymd(new Date(Date.now() + 7 * DIA));

  const [empresaRes, osRes, clientesRes, agRes, servicosRes, aiRes] = await Promise.all([
    supabaseAdmin
      .from("empresa")
      .select("nome_fantasia, endereco, horario_funcionamento, whatsapp, instagram, facebook, website")
      .eq("owner_id", ownerId)
      .maybeSingle(),
    supabaseAdmin
      .from("ordens_servico")
      .select("id, valor, status, servico_id, cliente_id, created_at")
      .eq("owner_id", ownerId)
      .gte("created_at", desde30),
    supabaseAdmin.from("clientes").select("id, created_at").eq("owner_id", ownerId),
    supabaseAdmin
      .from("agendamentos")
      .select("id, data_agendada")
      .eq("owner_id", ownerId)
      .gte("data_agendada", hoje)
      .lte("data_agendada", daqui7),
    supabaseAdmin
      .from("servicos")
      .select("id, nome, preco_padrao, categoria, descricao, tempo_estimado_min, ativo")
      .eq("owner_id", ownerId),
    supabaseAdmin
      .from("tenant_ai_settings")
      .select("preferred_tone, business_context")
      .eq("tenant_id", ownerId)
      .maybeSingle(),
  ]);

  assertOk("empresa", empresaRes.error);
  assertOk("ordens_servico", osRes.error);
  assertOk("clientes", clientesRes.error);
  assertOk("agendamentos", agRes.error);
  assertOk("servicos", servicosRes.error);

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
  const { data: osRecentes, error: osRecentesErr } = await supabaseAdmin
    .from("ordens_servico")
    .select("cliente_id")
    .eq("owner_id", ownerId)
    .gte("created_at", desde60);
  assertOk("ordens_servico_recentes", osRecentesErr);
  const ativos = new Set(((osRecentes ?? []) as any[]).map((o) => String(o.cliente_id)));
  const clientes = (clientesRes.data ?? []) as any[];

  const emp = (empresaRes.data ?? null) as any;
  const bc = (((aiRes.data as any)?.business_context ?? {}) as BusinessContext);
  const tom = ((aiRes.data as any)?.preferred_tone as string | null) ?? ((bc.tom_de_voz as string | null) ?? null);
  const contextoNegocio = mergeEmpresaIntoContext(bc, emp);

  return {
    empresa: emp?.nome_fantasia ?? "Seu lava-rápido",
    identidade: {
      nomeFantasia: emp?.nome_fantasia ?? null,
      endereco: emp?.endereco ?? null,
      horarioFuncionamento: emp?.horario_funcionamento ?? null,
      whatsapp: emp?.whatsapp ?? null,
      instagram: emp?.instagram ?? null,
      facebook: emp?.facebook ?? null,
      website: emp?.website ?? null,
      tomDeVoz: tom,
      contexto: contextoNegocio,
      completude: businessContextCompleteness(contextoNegocio, tom),
    },
    servicosAtivos: ((servicosRes.data ?? []) as any[])
      .filter((s) => s.ativo !== false)
      .map((s) => ({
        nome: s.nome as string,
        preco: Number(s.preco_padrao ?? 0),
        categoria: (s.categoria ?? null) as string | null,
        descricao: (s.descricao ?? null) as string | null,
        tempoMin: (s.tempo_estimado_min ?? null) as number | null,
      }))
      .slice(0, 30),
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
  const { identidade, servicosAtivos, ...operacional } = ctx;
  const contextoIncompleto = identidade.completude < 50;

  const pack = buildSkillContext("campaign", {
    contexto: identidade.contexto,
    empresa: {
      nome_fantasia: identidade.nomeFantasia,
      endereco: identidade.endereco,
      horario_funcionamento: identidade.horarioFuncionamento,
      whatsapp: identidade.whatsapp,
    },
    tom: identidade.tomDeVoz,
    servicos: servicosAtivos.map((s) => ({ nome: s.nome, preco: s.preco })),
  });

  const conhecimentoCompacto = {
    nomeFantasia: identidade.nomeFantasia,
    endereco: identidade.endereco,
    horarioFuncionamento: identidade.horarioFuncionamento,
    whatsapp: identidade.whatsapp,
    referenciasDigitais: {
      instagram: identidade.instagram,
      facebook: identidade.facebook,
      website: identidade.website,
    },
    identidade: pack.identidade,
    regras: pack.regras,
    servicos: pack.servicosRelevantes ?? [],
    faltando: pack.faltando,
    completude: identidade.completude,
  };

  return [
    "Você é o Consultor de Crescimento do LavaFlow, especialista em operação de lava-rápidos no Brasil.",
    "Responda em português do Brasil, de forma direta, prática e acionável. Use no máximo 200 palavras.",
    "REGRAS OBRIGATÓRIAS:",
    "1. Responda especificamente à pergunta feita — nunca repita uma resposta genérica ou o mesmo texto de outra pergunta.",
    "2. Cite ao menos dois números reais de DADOS OPERACIONAIS e explique o que eles indicam. Números vêm SEMPRE dos DADOS OPERACIONAIS, nunca do conhecimento do negócio.",
    "3. Nunca invente números, nomes de serviços, clientes, bairros, diferenciais, concorrentes ou conteúdo de redes sociais. Use apenas o que está abaixo.",
    "4. Personalize recomendações e campanhas ao tom de voz, região, público-alvo, diferenciais, objetivos e restrições cadastrados em CONHECIMENTO DO NEGÓCIO.",
    "5. URLs de redes/site são apenas referências cadastradas; não assuma que seu conteúdo foi lido ou sincronizado.",
    "6. Termine com uma lista curta de ações concretas (hoje / esta semana).",
    contextoIncompleto
      ? "7. O conhecimento do negócio está incompleto: quando isso limitar a resposta, diga qual informação falta preencher em Configurações → Conhecimento do Negócio, em vez de assumir."
      : "7. Adapte o tom e o foco ao tema da pergunta (faturamento, serviços, clientes, agenda).",
    semDados
      ? "8. Este estabelecimento ainda não possui histórico registrado: seja transparente sobre isso e foque em quais registros iniciar."
      : "8. Priorize oportunidades sustentadas pelos dados operacionais.",
    "",
    "CONHECIMENTO DO NEGÓCIO (contexto compacto informado pelo estabelecimento; não é fonte de números):",
    JSON.stringify(conhecimentoCompacto),
    "",
    "DADOS OPERACIONAIS (fonte única de verdade para números):",
    JSON.stringify(operacional),
  ].join("\n");
}

