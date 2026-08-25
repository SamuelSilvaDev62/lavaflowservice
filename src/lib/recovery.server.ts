import { mergeEmpresaIntoContext, type BusinessContext } from "@/lib/business-context";
import { GROWTH_PRICE_BRL } from "@/lib/plans";
import { buildSkillContext } from "@/lib/skill-context";

const DIA = 86_400_000;
const LOOKBACK_DIAS = 365;
const CONTATO_RECENTE_DIAS = 14;
export const RECOVERY_ATTRIBUTION_DAYS = 14;

export type RecoveryPriority = "alta" | "media" | "baixa";
export type RecoveryConfidence = "alta" | "media" | "baixa";

export type RecoveryCandidate = {
  clienteId: string;
  nome: string;
  telefone: string;
  ultimaVisita: string;
  diasSemRetornar: number;
  visitas: number;
  gastoTotal: number;
  ticketMedio: number;
  intervaloEsperadoDias: number | null;
  atrasoDias: number;
  score: number;
  prioridade: RecoveryPriority;
  confianca: RecoveryConfidence;
  receitaPotencial: number;
  valorEsperado: number;
  motivo: string;
};

export type RecoveryEngineData = {
  candidatos: RecoveryCandidate[];
  resumo: {
    elegiveis: number;
    altaPrioridade: number;
    receitaPotencial: number;
    valorEsperado: number;
    ticketMedio: number;
    taxaConversaoUsada: number;
    taxaBaseadaEmHistorico: boolean;
    excluidosContatoRecente: number;
    excluidosJaAgendados: number;
  };
  mensagemSugerida: string;
  contextoUsado: string[];
  contextoFaltando: string[];
  regras: {
    lookbackDias: number;
    contatoRecenteDias: number;
    atribuicaoDias: number;
  };
};

export type RecoveryRoi = {
  periodoInicio: string;
  campanhasCriadas: number;
  execucoesDoMotor: number;
  contatosEnviados: number;
  clientesRecuperados: number;
  taxaConversao: number;
  receitaAtribuida: number;
  custoIaRegistrado: number;
  custoSobreReceita: number | null;
  multiploVsGrowth: number;
  custoMensageriaRastreado: boolean;
  atribuicao: {
    janelaDias: number;
    metodo: string;
  };
};

function round2(v: number) {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function assertOk(label: string, error: any) {
  if (!error) return;
  console.error(`[recovery] falha em ${label}`, error?.message ?? error);
  throw new Error("Não foi possível calcular as oportunidades de recuperação agora.");
}

function firstClause(value?: string | null) {
  return String(value ?? "")
    .split(/[,.;\n]/)
    .map((s) => s.trim())
    .find(Boolean)
    ?.slice(0, 90) ?? "";
}

function buildMessage(
  contexto: BusinessContext,
  empresa: any,
  tom: string | null,
) {
  const pack = buildSkillContext("recovery", {
    contexto,
    empresa,
    tom,
  });
  const identidade = pack.identidade;
  const regras = pack.regras;
  const tomNormalizado = String(identidade.tom_de_voz ?? "").toLowerCase();
  const restricoes = `${regras.restricoes_campanhas ?? ""} ${regras.restricoes_comunicacao ?? ""}`.toLowerCase();
  const formal =
    tomNormalizado.includes("premium") ||
    tomNormalizado.includes("profissional") ||
    restricoes.includes("não usar gíria") ||
    restricoes.includes("nao usar giria");

  let mensagem = formal
    ? "Olá {{nome}}! Notamos que faz um tempo desde a sua última visita. Temos horários disponíveis esta semana para cuidar do seu veículo novamente."
    : "Oi {{nome}}! Faz um tempinho que você não aparece por aqui. Temos horários esta semana para cuidar do seu veículo de novo.";

  const regiao = identidade.bairros_atendidos ?? identidade.cidade;
  if (regiao) mensagem += ` Atendemos ${regiao}.`;

  const diferencial = firstClause(identidade.diferenciais);
  if (diferencial) mensagem += ` ${diferencial}.`;

  mensagem += formal ? " Gostaria de reservar um horário?" : " Quer reservar um horário?";

  return {
    mensagem: mensagem.replace(/\s+/g, " ").trim().slice(0, 900),
    contextoUsado: Array.from(new Set([...Object.keys(identidade), ...Object.keys(regras)])),
    contextoFaltando: pack.faltando,
  };
}

export async function buildRecoveryEngineData(
  supabase: any,
  ownerId: string,
): Promise<RecoveryEngineData> {
  const agora = Date.now();
  const desdeHistorico = new Date(agora - LOOKBACK_DIAS * DIA).toISOString();
  const desdeContatoRecente = new Date(agora - CONTATO_RECENTE_DIAS * DIA).toISOString();
  const hoje = new Date().toISOString().slice(0, 10);
  const futuro30 = new Date(agora + 30 * DIA).toISOString().slice(0, 10);

  const [clientesRes, ordensRes, agendaRes, campanhasRes, settingsRes, empresaRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, telefone, whatsapp, created_at")
      .eq("owner_id", ownerId),
    supabase
      .from("ordens_servico")
      .select("id, cliente_id, valor, status, created_at, entregue_em")
      .eq("owner_id", ownerId)
      .eq("status", "entregue")
      .gte("created_at", desdeHistorico)
      .order("created_at", { ascending: true }),
    supabase
      .from("agendamentos")
      .select("cliente_id, status, data_agendada")
      .eq("owner_id", ownerId)
      .gte("data_agendada", hoje)
      .lte("data_agendada", futuro30),
    supabase
      .from("campanhas")
      .select("id, tipo, created_at")
      .eq("owner_id", ownerId)
      .eq("tipo", "inativos")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("tenant_ai_settings")
      .select("preferred_tone, business_context")
      .eq("tenant_id", ownerId)
      .maybeSingle(),
    supabase
      .from("empresa")
      .select("nome_fantasia, endereco, horario_funcionamento, whatsapp, instagram, facebook, website")
      .eq("owner_id", ownerId)
      .maybeSingle(),
  ]);

  assertOk("clientes", clientesRes.error);
  assertOk("ordens_servico", ordensRes.error);
  assertOk("agendamentos", agendaRes.error);
  assertOk("campanhas", campanhasRes.error);
  assertOk("tenant_ai_settings", settingsRes.error);
  assertOk("empresa", empresaRes.error);

  const campanhasIds = (campanhasRes.data ?? []).map((c: any) => c.id);
  const alvosRes = campanhasIds.length
    ? await supabase
        .from("campanha_alvos")
        .select("id, campanha_id, cliente_id, status, sent_at, converted_at, created_at")
        .eq("owner_id", ownerId)
        .in("campanha_id", campanhasIds)
        .limit(5000)
    : { data: [] as any[], error: null };
  assertOk("campanha_alvos", alvosRes.error);

  const alvos = (alvosRes.data ?? []) as any[];
  const enviadosHistorico = alvos.filter((a) => ["enviado", "convertido"].includes(a.status)).length;
  const convertidosHistorico = alvos.filter((a) => a.status === "convertido").length;
  const taxaBaseadaEmHistorico = enviadosHistorico >= 10;
  const taxaConversaoUsada = taxaBaseadaEmHistorico
    ? clamp(convertidosHistorico / Math.max(1, enviadosHistorico), 0.05, 0.6)
    : 0.2;

  const contatoRecente = new Set(
    alvos
      .filter((a) => a.cliente_id && a.sent_at && a.sent_at >= desdeContatoRecente)
      .map((a) => String(a.cliente_id)),
  );
  const jaAgendados = new Set(
    (agendaRes.data ?? [])
      .filter((a: any) => !["cancelado", "nao_compareceu"].includes(a.status))
      .map((a: any) => String(a.cliente_id))
      .filter(Boolean),
  );

  const ordens = (ordensRes.data ?? []) as any[];
  const porCliente = new Map<string, any[]>();
  for (const ordem of ordens) {
    if (!ordem.cliente_id) continue;
    const arr = porCliente.get(ordem.cliente_id) ?? [];
    arr.push(ordem);
    porCliente.set(ordem.cliente_id, arr);
  }

  const tickets = ordens
    .map((o) => Number(o.valor ?? 0))
    .filter((v) => Number.isFinite(v) && v > 0);
  const ticketMedioGlobal = tickets.length
    ? tickets.reduce((s, v) => s + v, 0) / tickets.length
    : 50;

  let excluidosContatoRecente = 0;
  let excluidosJaAgendados = 0;
  const candidatos: RecoveryCandidate[] = [];

  for (const cliente of clientesRes.data ?? []) {
    const telefone = String(cliente.whatsapp ?? cliente.telefone ?? "").trim();
    if (!telefone) continue;

    const visitas = (porCliente.get(cliente.id) ?? []).slice().sort((a, b) => {
      const da = String(a.entregue_em ?? a.created_at ?? "");
      const db = String(b.entregue_em ?? b.created_at ?? "");
      return da.localeCompare(db);
    });
    if (!visitas.length) continue;

    const datas = visitas
      .map((o) => new Date(o.entregue_em ?? o.created_at).getTime())
      .filter(Number.isFinite);
    if (!datas.length) continue;

    const intervalos: number[] = [];
    for (let i = 1; i < datas.length; i++) {
      intervalos.push(Math.max(1, Math.round((datas[i]! - datas[i - 1]!) / DIA)));
    }
    const intervaloMediano = median(intervalos);
    const intervaloEsperadoDias = intervaloMediano == null
      ? null
      : Math.round(clamp(intervaloMediano, 14, 120));

    const ultimaMs = datas[datas.length - 1]!;
    const diasSemRetornar = Math.max(0, Math.floor((agora - ultimaMs) / DIA));
    const limiteRetorno = intervaloEsperadoDias != null
      ? Math.max(30, Math.round(intervaloEsperadoDias * 1.25))
      : visitas.length >= 2
        ? 45
        : 60;

    if (diasSemRetornar < limiteRetorno) continue;
    if (contatoRecente.has(cliente.id)) {
      excluidosContatoRecente += 1;
      continue;
    }
    if (jaAgendados.has(cliente.id)) {
      excluidosJaAgendados += 1;
      continue;
    }

    const valores = visitas.map((o) => Number(o.valor ?? 0)).filter((v) => Number.isFinite(v));
    const gastoTotal = valores.reduce((s, v) => s + v, 0);
    const ticketMedio = valores.length ? gastoTotal / valores.length : ticketMedioGlobal;
    const atrasoDias = Math.max(0, diasSemRetornar - limiteRetorno);

    const pontosRecorrencia = Math.min(25, visitas.length * 5);
    const pontosAtraso = Math.min(40, 20 + (atrasoDias / Math.max(1, limiteRetorno)) * 20);
    const razaoTicket = ticketMedioGlobal > 0 ? ticketMedio / ticketMedioGlobal : 1;
    const pontosValor = clamp(razaoTicket * 12, 5, 20);
    const pontosConfianca = intervaloEsperadoDias != null ? 15 : visitas.length >= 2 ? 10 : 5;
    let score = Math.round(clamp(pontosRecorrencia + pontosAtraso + pontosValor + pontosConfianca, 0, 100));
    if (diasSemRetornar > 240) score = Math.max(35, score - 10);

    const prioridade: RecoveryPriority = score >= 75 ? "alta" : score >= 55 ? "media" : "baixa";
    const confianca: RecoveryConfidence =
      visitas.length >= 4 && intervalos.length >= 2 ? "alta" : visitas.length >= 2 ? "media" : "baixa";
    const receitaPotencial = round2(ticketMedio || ticketMedioGlobal || 50);
    const valorEsperado = round2(receitaPotencial * taxaConversaoUsada);
    const motivo = intervaloEsperadoDias != null
      ? `Costuma retornar a cada ~${intervaloEsperadoDias} dias e já está há ${diasSemRetornar} dias sem voltar.`
      : visitas.length >= 2
        ? `Já fez ${visitas.length} visitas e está há ${diasSemRetornar} dias sem retornar.`
        : `Está há ${diasSemRetornar} dias sem retornar após a primeira visita.`;

    candidatos.push({
      clienteId: cliente.id,
      nome: cliente.nome ?? "Cliente",
      telefone,
      ultimaVisita: new Date(ultimaMs).toISOString(),
      diasSemRetornar,
      visitas: visitas.length,
      gastoTotal: round2(gastoTotal),
      ticketMedio: round2(ticketMedio),
      intervaloEsperadoDias,
      atrasoDias,
      score,
      prioridade,
      confianca,
      receitaPotencial,
      valorEsperado,
      motivo,
    });
  }

  candidatos.sort((a, b) =>
    b.score - a.score ||
    b.receitaPotencial - a.receitaPotencial ||
    b.diasSemRetornar - a.diasSemRetornar,
  );

  const bc = ((settingsRes.data as any)?.business_context ?? {}) as BusinessContext;
  const empresa = (empresaRes.data ?? null) as any;
  const contexto = mergeEmpresaIntoContext(bc, empresa);
  const tom = ((settingsRes.data as any)?.preferred_tone as string | null) ?? (contexto.tom_de_voz as string | null) ?? null;
  const mensagem = buildMessage(contexto, empresa, tom);

  return {
    candidatos: candidatos.slice(0, 100),
    resumo: {
      elegiveis: candidatos.length,
      altaPrioridade: candidatos.filter((c) => c.prioridade === "alta").length,
      receitaPotencial: round2(candidatos.reduce((s, c) => s + c.receitaPotencial, 0)),
      valorEsperado: round2(candidatos.reduce((s, c) => s + c.valorEsperado, 0)),
      ticketMedio: round2(ticketMedioGlobal),
      taxaConversaoUsada: round2(taxaConversaoUsada),
      taxaBaseadaEmHistorico,
      excluidosContatoRecente,
      excluidosJaAgendados,
    },
    mensagemSugerida: mensagem.mensagem,
    contextoUsado: mensagem.contextoUsado,
    contextoFaltando: mensagem.contextoFaltando,
    regras: {
      lookbackDias: LOOKBACK_DIAS,
      contatoRecenteDias: CONTATO_RECENTE_DIAS,
      atribuicaoDias: RECOVERY_ATTRIBUTION_DAYS,
    },
  };
}

function startOfCurrentMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export async function buildRecoveryRoi(
  supabase: any,
  ownerId: string,
): Promise<RecoveryRoi> {
  const periodoInicio = startOfCurrentMonthIso();

  const [campanhasRes, receitasRes, usageRes, tasksRes] = await Promise.all([
    supabase
      .from("campanhas")
      .select("id, tipo, created_at")
      .eq("owner_id", ownerId)
      .eq("tipo", "inativos")
      .limit(500),
    supabase
      .from("receita_influenciada")
      .select("id, cliente_id, valor, metadata, created_at")
      .eq("owner_id", ownerId)
      .eq("origem", "CAMPANHA")
      .gte("created_at", periodoInicio)
      .limit(1000),
    supabase
      .from("ai_usage_logs")
      .select("estimated_cost, created_at")
      .eq("tenant_id", ownerId)
      .eq("task_type", "recovery_engine")
      .gte("created_at", periodoInicio)
      .limit(1000),
    supabase
      .from("flow_tasks")
      .select("id, created_at")
      .eq("tenant_id", ownerId)
      .eq("task_type", "recovery_engine")
      .gte("created_at", periodoInicio)
      .limit(1000),
  ]);

  assertOk("roi_campanhas", campanhasRes.error);
  assertOk("roi_receitas", receitasRes.error);
  assertOk("roi_usage", usageRes.error);
  assertOk("roi_tasks", tasksRes.error);

  const campanhas = (campanhasRes.data ?? []) as any[];
  const campanhaIds = campanhas.map((c) => c.id);
  const alvosRes = campanhaIds.length
    ? await supabase
        .from("campanha_alvos")
        .select("id, campanha_id, cliente_id, status, sent_at, converted_at")
        .eq("owner_id", ownerId)
        .in("campanha_id", campanhaIds)
        .limit(5000)
    : { data: [] as any[], error: null };
  assertOk("roi_alvos", alvosRes.error);

  const alvos = (alvosRes.data ?? []) as any[];
  const enviados = alvos.filter((a) => a.sent_at && a.sent_at >= periodoInicio);
  const convertidos = alvos.filter((a) => a.converted_at && a.converted_at >= periodoInicio);
  const campanhaSet = new Set(campanhaIds);
  const receitasRecovery = ((receitasRes.data ?? []) as any[]).filter((r) => {
    const campanhaId = r.metadata?.campanha_id;
    return campanhaId && campanhaSet.has(campanhaId);
  });

  const receitaAtribuida = round2(
    receitasRecovery.reduce((s, r) => s + Number(r.valor ?? 0), 0),
  );
  const custoIaRegistrado = round2(
    ((usageRes.data ?? []) as any[]).reduce((s, r) => s + Number(r.estimated_cost ?? 0), 0),
  );
  const clientesRecuperados = new Set(
    convertidos.map((a) => a.cliente_id).filter(Boolean),
  ).size;
  const taxaConversao = enviados.length ? convertidos.length / enviados.length : 0;
  const custoSobreReceita = receitaAtribuida > 0
    ? round2(custoIaRegistrado / receitaAtribuida)
    : null;

  return {
    periodoInicio,
    campanhasCriadas: campanhas.filter((c) => c.created_at >= periodoInicio).length,
    execucoesDoMotor: (tasksRes.data ?? []).length,
    contatosEnviados: enviados.length,
    clientesRecuperados,
    taxaConversao: round2(taxaConversao),
    receitaAtribuida,
    custoIaRegistrado,
    custoSobreReceita,
    multiploVsGrowth: round2(receitaAtribuida / GROWTH_PRICE_BRL),
    custoMensageriaRastreado: false,
    atribuicao: {
      janelaDias: RECOVERY_ATTRIBUTION_DAYS,
      metodo: `OS entregue em até ${RECOVERY_ATTRIBUTION_DAYS} dias após um envio confirmado; cada OS recebe no máximo uma atribuição de campanha.`,
    },
  };
}

export async function logRecoveryRun(
  supabase: any,
  input: {
    ownerId: string;
    userId?: string | null;
    campanhaId: string;
    candidatos: number;
    receitaPotencial: number;
    valorEsperado: number;
    taxaConversao: number;
  },
) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("flow_tasks").insert({
    tenant_id: input.ownerId,
    user_id: input.userId ?? null,
    module: "clientes",
    task_type: "recovery_engine",
    input: {
      campanha_id: input.campanhaId,
      candidatos: input.candidatos,
    },
    output: {
      receita_potencial: input.receitaPotencial,
      valor_esperado: input.valorEsperado,
      taxa_conversao: input.taxaConversao,
      attribution_window_days: RECOVERY_ATTRIBUTION_DAYS,
    },
    execution_mode: "rule",
    status: "completed",
    tokens_used: 0,
    estimated_cost: 0,
    started_at: now,
    completed_at: now,
  } as any);
  if (error) {
    console.error("[recovery] não foi possível registrar flow_task", error.message);
  }
}
