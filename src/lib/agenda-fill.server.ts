import { mergeEmpresaIntoContext, type BusinessContext } from "@/lib/business-context";
import { buildSkillContext } from "@/lib/skill-context";

const DIA = 86_400_000;
const APP_TZ = "America/Sao_Paulo";
const LOOKAHEAD_DIAS = 7;
const LOOKBACK_DIAS = 365;
const CONTATO_RECENTE_DIAS = 14;
export const AGENDA_FILL_ATTRIBUTION_DAYS = 14;

export type AgendaFillCandidate = {
  clienteId: string;
  nome: string;
  telefone: string;
  visitas: number;
  ultimaVisita: string;
  intervaloEsperadoDias: number;
  diasParaJanela: number;
  ticketMedio: number;
  score: number;
  confianca: "alta" | "media" | "baixa";
  receitaPotencial: number;
  valorEsperado: number;
  motivo: string;
};

export type AgendaFillData = {
  oportunidade: {
    data: string | null;
    dataLabel: string | null;
    capacidadeRestante: number;
    agendamentos: number;
    horariosLivres: number;
    ocupacao: number | null;
    ticketMedio: number;
    potencialCapacidade: number;
  };
  candidatos: AgendaFillCandidate[];
  resumo: {
    elegiveis: number;
    contatosRecomendados: number;
    receitaPotencialContatos: number;
    valorEsperado: number;
    taxaConversaoUsada: number;
    taxaBaseadaEmHistorico: boolean;
    excluidosContatoRecente: number;
    excluidosJaAgendados: number;
  };
  mensagemSugerida: string;
  contextoUsado: string[];
  contextoFaltando: string[];
  regras: {
    lookaheadDias: number;
    lookbackDias: number;
    contatoRecenteDias: number;
    atribuicaoDias: number;
  };
};

function round2(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function assertOk(label: string, error: any) {
  if (!error) return;
  console.error(`[agenda-fill] falha em ${label}`, error?.message ?? error);
  throw new Error("Não foi possível calcular o Agenda Fill agora.");
}

function localDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * DIA);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function localTimeMinutes() {
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
}

function weekdayForDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

function hmToMinutes(value: string | null | undefined) {
  const s = String(value ?? "00:00").slice(0, 5);
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}

function isActiveAppointment(status: string | null | undefined) {
  return !["concluido", "cancelado", "nao_compareceu"].includes(String(status ?? ""));
}

function dateKeyToMs(dateKey: string) {
  return new Date(`${dateKey}T12:00:00-03:00`).getTime();
}

function formatTargetDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dateKey}T12:00:00-03:00`));
}

function firstClause(value?: string | null) {
  return String(value ?? "")
    .split(/[,.;\n]/)
    .map((s) => s.trim())
    .find(Boolean)
    ?.slice(0, 90) ?? "";
}

function buildMessage(contexto: BusinessContext, empresa: any, tom: string | null, targetDate: string | null) {
  const pack = buildSkillContext("agenda_fill", { contexto, empresa, tom });
  const identidade = pack.identidade;
  const regras = pack.regras;
  const tomNormalizado = String(identidade.tom_de_voz ?? "").toLowerCase();
  const restricoes = `${regras.restricoes_campanhas ?? ""} ${regras.restricoes_comunicacao ?? ""}`.toLowerCase();
  const formal =
    tomNormalizado.includes("premium") ||
    tomNormalizado.includes("profissional") ||
    restricoes.includes("não usar gíria") ||
    restricoes.includes("nao usar giria");
  const dataLabel = targetDate ? formatTargetDate(targetDate) : "nos próximos dias";

  let mensagem = formal
    ? `Olá {{nome}}! Abrimos alguns horários para ${dataLabel} e lembramos de você. Se estiver pensando em cuidar do veículo, posso reservar um horário.`
    : `Oi {{nome}}! Abriram alguns horários para ${dataLabel} e lembrei de você. Se quiser dar aquele trato no carro, posso separar um horário.`;

  const regiao = identidade.bairros_atendidos ?? identidade.cidade;
  if (regiao) mensagem += ` Atendemos ${regiao}.`;
  const diferencial = firstClause(identidade.diferenciais);
  if (diferencial) mensagem += ` ${diferencial}.`;
  mensagem += formal ? " Gostaria que eu verificasse a disponibilidade?" : " Quer que eu veja os horários?";

  return {
    mensagem: mensagem.replace(/\s+/g, " ").trim().slice(0, 900),
    contextoUsado: Array.from(new Set([...Object.keys(identidade), ...Object.keys(regras)])),
    contextoFaltando: pack.faltando,
  };
}

export async function buildAgendaFillData(supabase: any, ownerId: string): Promise<AgendaFillData> {
  const agora = Date.now();
  const hoje = localDate(0);
  const fimJanela = localDate(LOOKAHEAD_DIAS - 1);
  const futuro30 = localDate(30);
  const desdeHistorico = new Date(agora - LOOKBACK_DIAS * DIA).toISOString();
  const desdeContato = new Date(agora - CONTATO_RECENTE_DIAS * DIA).toISOString();

  const [agendaCfgRes, agenda7Res, agenda30Res, clientesRes, ordensRes, contatosRes, campanhasRes, settingsRes, empresaRes] = await Promise.all([
    supabase
      .from("agenda_config")
      .select("hora_inicio, hora_fim, intervalo_min, capacidade_simultanea, dias_semana")
      .eq("owner_id", ownerId)
      .maybeSingle(),
    supabase
      .from("agendamentos")
      .select("cliente_id, status, data_agendada, hora_agendada")
      .eq("owner_id", ownerId)
      .gte("data_agendada", hoje)
      .lte("data_agendada", fimJanela)
      .limit(3000),
    supabase
      .from("agendamentos")
      .select("cliente_id, status, data_agendada")
      .eq("owner_id", ownerId)
      .gte("data_agendada", hoje)
      .lte("data_agendada", futuro30)
      .limit(5000),
    supabase
      .from("clientes")
      .select("id, nome, telefone, whatsapp")
      .eq("owner_id", ownerId),
    supabase
      .from("ordens_servico")
      .select("cliente_id, valor, status, created_at, entregue_em")
      .eq("owner_id", ownerId)
      .eq("status", "entregue")
      .gte("created_at", desdeHistorico)
      .order("created_at", { ascending: true })
      .limit(10000),
    supabase
      .from("campanha_alvos")
      .select("cliente_id, status, sent_at")
      .eq("owner_id", ownerId)
      .gte("sent_at", desdeContato)
      .limit(5000),
    supabase
      .from("campanhas")
      .select("id, tipo, metadata, created_at")
      .eq("owner_id", ownerId)
      .eq("tipo", "baixa_ocupacao")
      .order("created_at", { ascending: false })
      .limit(200),
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

  assertOk("agenda_config", agendaCfgRes.error);
  assertOk("agenda_7d", agenda7Res.error);
  assertOk("agenda_30d", agenda30Res.error);
  assertOk("clientes", clientesRes.error);
  assertOk("ordens_servico", ordensRes.error);
  assertOk("contatos_recentes", contatosRes.error);
  assertOk("campanhas", campanhasRes.error);
  assertOk("tenant_ai_settings", settingsRes.error);
  assertOk("empresa", empresaRes.error);

  const cfg = agendaCfgRes.data as any;
  const inicio = hmToMinutes(cfg?.hora_inicio ?? "08:00");
  const fim = hmToMinutes(cfg?.hora_fim ?? "18:00");
  const intervalo = Math.max(15, Number(cfg?.intervalo_min ?? 60));
  const simultanea = Math.max(1, Number(cfg?.capacidade_simultanea ?? 1));
  const diasSemana = (cfg?.dias_semana ?? []) as number[];
  const agoraMin = localTimeMinutes();
  const agenda7 = (agenda7Res.data ?? []) as any[];

  const dias = Array.from({ length: LOOKAHEAD_DIAS }, (_, offset) => {
    const data = localDate(offset);
    const dow = weekdayForDate(data);
    const aberto = !cfg || diasSemana.length === 0 || diasSemana.includes(dow);
    if (!aberto || fim <= inicio) return null;

    let primeiroSlot = inicio;
    if (offset === 0) {
      primeiroSlot = agoraMin <= inicio
        ? inicio
        : inicio + Math.ceil((agoraMin - inicio) / intervalo) * intervalo;
      if (primeiroSlot >= fim) return null;
    }

    let capacidade = 0;
    for (let slot = primeiroSlot; slot + intervalo <= fim; slot += intervalo) capacidade += simultanea;
    if (capacidade <= 0) return null;

    const agendamentos = agenda7.filter((a) => {
      if (a.data_agendada !== data || !isActiveAppointment(a.status)) return false;
      if (offset !== 0) return true;
      return hmToMinutes(a.hora_agendada) >= primeiroSlot;
    }).length;
    const livres = Math.max(0, capacidade - agendamentos);
    const ocupacao = capacidade > 0 ? round2(agendamentos / capacidade) : null;
    return { data, capacidade, agendamentos, livres, ocupacao };
  }).filter(Boolean) as Array<{ data: string; capacidade: number; agendamentos: number; livres: number; ocupacao: number }>;

  const alvo = dias
    .filter((d) => d.livres > 0)
    .sort((a, b) => b.livres - a.livres || a.ocupacao - b.ocupacao || a.data.localeCompare(b.data))[0] ?? null;

  const ordens = (ordensRes.data ?? []) as any[];
  const ticketsGlobais = ordens.map((o) => Number(o.valor ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
  const ticketGlobal = ticketsGlobais.length
    ? ticketsGlobais.reduce((s, v) => s + v, 0) / ticketsGlobais.length
    : 50;

  const campanhasIds = (campanhasRes.data ?? []).map((c: any) => c.id);
  const historicoAlvosRes = campanhasIds.length
    ? await supabase
        .from("campanha_alvos")
        .select("campanha_id, status, sent_at, converted_at")
        .eq("owner_id", ownerId)
        .in("campanha_id", campanhasIds)
        .limit(5000)
    : { data: [] as any[], error: null };
  assertOk("historico_agenda_fill", historicoAlvosRes.error);
  const historicoAlvos = (historicoAlvosRes.data ?? []) as any[];
  const enviados = historicoAlvos.filter((a) => ["enviado", "convertido"].includes(a.status)).length;
  const convertidos = historicoAlvos.filter((a) => a.status === "convertido").length;
  const taxaBaseadaEmHistorico = enviados >= 10;
  const taxaConversaoUsada = taxaBaseadaEmHistorico ? clamp(convertidos / Math.max(1, enviados), 0.05, 0.6) : 0.2;

  const contatoRecente = new Set(
    ((contatosRes.data ?? []) as any[])
      .filter((a) => a.cliente_id && a.sent_at)
      .map((a) => String(a.cliente_id)),
  );
  const jaAgendados = new Set(
    ((agenda30Res.data ?? []) as any[])
      .filter((a) => a.cliente_id && isActiveAppointment(a.status))
      .map((a) => String(a.cliente_id)),
  );

  const porCliente = new Map<string, any[]>();
  for (const ordem of ordens) {
    if (!ordem.cliente_id) continue;
    const arr = porCliente.get(String(ordem.cliente_id)) ?? [];
    arr.push(ordem);
    porCliente.set(String(ordem.cliente_id), arr);
  }

  let excluidosContatoRecente = 0;
  let excluidosJaAgendados = 0;
  const candidatos: AgendaFillCandidate[] = [];
  const alvoMs = alvo ? dateKeyToMs(alvo.data) : null;

  if (alvo && alvoMs != null) {
    for (const cliente of clientesRes.data ?? []) {
      const clienteId = String(cliente.id);
      const telefone = String(cliente.whatsapp ?? cliente.telefone ?? "").trim();
      if (!telefone) continue;
      const visitas = (porCliente.get(clienteId) ?? []).slice().sort((a, b) => {
        const da = String(a.entregue_em ?? a.created_at ?? "");
        const db = String(b.entregue_em ?? b.created_at ?? "");
        return da.localeCompare(db);
      });
      if (!visitas.length) continue;
      if (contatoRecente.has(clienteId)) {
        excluidosContatoRecente += 1;
        continue;
      }
      if (jaAgendados.has(clienteId)) {
        excluidosJaAgendados += 1;
        continue;
      }

      const datas = visitas
        .map((o) => new Date(o.entregue_em ?? o.created_at).getTime())
        .filter(Number.isFinite);
      if (!datas.length) continue;
      const intervalos: number[] = [];
      for (let i = 1; i < datas.length; i++) {
        intervalos.push(Math.max(1, Math.round((datas[i]! - datas[i - 1]!) / DIA)));
      }
      const mediana = median(intervalos);
      const intervaloEsperadoDias = Math.round(clamp(mediana ?? 45, 14, 120));
      const ultimaMs = datas[datas.length - 1]!;
      const proximaEsperadaMs = ultimaMs + intervaloEsperadoDias * DIA;
      const diasParaJanela = Math.round((alvoMs - proximaEsperadaMs) / DIA);

      // Complementa o Recovery: aqui buscamos quem está perto da própria janela de retorno,
      // e não clientes muito atrasados. Até 10 dias antes ou 45 depois da data esperada.
      if (diasParaJanela < -10 || diasParaJanela > 45) continue;
      if (visitas.length === 1 && alvoMs - ultimaMs < 30 * DIA) continue;

      const valores = visitas.map((o) => Number(o.valor ?? 0)).filter((v) => Number.isFinite(v) && v > 0);
      const ticketMedio = valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : ticketGlobal;
      const distancia = Math.abs(diasParaJanela);
      const pontosTiming = distancia <= 7 ? 45 : distancia <= 14 ? 36 : distancia <= 30 ? 26 : 18;
      const pontosRecorrencia = Math.min(25, visitas.length * 5);
      const pontosValor = clamp((ticketMedio / Math.max(1, ticketGlobal)) * 15, 5, 20);
      const pontosConfianca = visitas.length >= 4 && intervalos.length >= 2 ? 10 : visitas.length >= 2 ? 7 : 3;
      const score = Math.round(clamp(pontosTiming + pontosRecorrencia + pontosValor + pontosConfianca, 0, 100));
      const confianca: AgendaFillCandidate["confianca"] = visitas.length >= 4 && intervalos.length >= 2
        ? "alta"
        : visitas.length >= 2
          ? "media"
          : "baixa";
      const receitaPotencial = round2(ticketMedio || ticketGlobal || 50);
      const valorEsperado = round2(receitaPotencial * taxaConversaoUsada);
      const motivo = visitas.length >= 2
        ? `Costuma voltar em cerca de ${intervaloEsperadoDias} dias; a próxima janela esperada fica próxima de ${formatTargetDate(alvo.data)}.`
        : `A última visita ficará a ${Math.max(0, Math.round((alvoMs - ultimaMs) / DIA))} dias da data alvo, uma janela razoável para um convite sem forçar retorno.`;

      candidatos.push({
        clienteId,
        nome: cliente.nome ?? "Cliente",
        telefone,
        visitas: visitas.length,
        ultimaVisita: new Date(ultimaMs).toISOString(),
        intervaloEsperadoDias,
        diasParaJanela,
        ticketMedio: round2(ticketMedio),
        score,
        confianca,
        receitaPotencial,
        valorEsperado,
        motivo,
      });
    }
  }

  candidatos.sort((a, b) => b.score - a.score || b.ticketMedio - a.ticketMedio);
  const contatosRecomendados = alvo
    ? Math.min(candidatos.length, Math.max(1, Math.min(20, alvo.livres * 2)))
    : 0;
  const selecionados = candidatos.slice(0, contatosRecomendados);
  const receitaPotencialContatos = round2(selecionados.reduce((s, c) => s + c.receitaPotencial, 0));
  const valorEsperado = round2(selecionados.reduce((s, c) => s + c.valorEsperado, 0));

  const bc = ((settingsRes.data as any)?.business_context ?? {}) as BusinessContext;
  const empresa = (empresaRes.data ?? null) as any;
  const contexto = mergeEmpresaIntoContext(bc, empresa);
  const tom = ((settingsRes.data as any)?.preferred_tone as string | null) ?? (contexto.tom_de_voz as string | null) ?? null;
  const mensagem = buildMessage(contexto, empresa, tom, alvo?.data ?? null);

  return {
    oportunidade: {
      data: alvo?.data ?? null,
      dataLabel: alvo ? formatTargetDate(alvo.data) : null,
      capacidadeRestante: alvo?.capacidade ?? 0,
      agendamentos: alvo?.agendamentos ?? 0,
      horariosLivres: alvo?.livres ?? 0,
      ocupacao: alvo?.ocupacao ?? null,
      ticketMedio: round2(ticketGlobal),
      potencialCapacidade: round2((alvo?.livres ?? 0) * ticketGlobal),
    },
    candidatos,
    resumo: {
      elegiveis: candidatos.length,
      contatosRecomendados,
      receitaPotencialContatos,
      valorEsperado,
      taxaConversaoUsada,
      taxaBaseadaEmHistorico,
      excluidosContatoRecente,
      excluidosJaAgendados,
    },
    mensagemSugerida: mensagem.mensagem,
    contextoUsado: mensagem.contextoUsado,
    contextoFaltando: mensagem.contextoFaltando,
    regras: {
      lookaheadDias: LOOKAHEAD_DIAS,
      lookbackDias: LOOKBACK_DIAS,
      contatoRecenteDias: CONTATO_RECENTE_DIAS,
      atribuicaoDias: AGENDA_FILL_ATTRIBUTION_DAYS,
    },
  };
}
