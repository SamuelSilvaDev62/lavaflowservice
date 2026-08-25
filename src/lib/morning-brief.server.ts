import { mergeEmpresaIntoContext, type BusinessContext } from "@/lib/business-context";
import { calculateCapacityTicket } from "@/lib/capacity-ticket";
import { buildSkillContext } from "@/lib/skill-context";
import { buildRecoveryEngineData } from "@/lib/recovery.server";

const DIA = 86_400_000;
const APP_TZ = "America/Sao_Paulo";

export type MorningBriefItemType = "atencao" | "oportunidade" | "positivo" | "info";

export type MorningBriefItem = {
  id: string;
  tipo: MorningBriefItemType;
  titulo: string;
  detalhe: string;
  metrica: string | null;
  impactoEstimado: number | null;
  acaoLabel: string | null;
  acaoRota: string | null;
};

export type MorningBriefData = {
  dataLocal: string;
  geradoEm: string;
  titulo: string;
  resumo: string;
  itens: MorningBriefItem[];
  metricas: {
    receita7d: number;
    receita7dAnterior: number;
    variacaoReceita7d: number | null;
    ticketMedio7d: number;
    agendamentosHoje: number;
    capacidadeHoje: number;
    horariosLivresHoje: number;
    ocupacaoHoje: number | null;
    veiculosProntos: number;
    recoveryAltaPrioridade: number;
    recoveryValorEsperado: number;
  };
  contextoUsado: string[];
  contextoFaltando: string[];
};

function round2(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function localDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function localDateOffset(offsetDays: number) {
  return localDateKey(new Date(Date.now() + offsetDays * DIA));
}

function localDayOfWeek() {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
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

function hmToMinutes(value: string | null | undefined) {
  const s = String(value ?? "00:00").slice(0, 5);
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}

function isActiveAppointment(status: string | null | undefined) {
  return !["concluido", "cancelado", "nao_compareceu"].includes(String(status ?? ""));
}

function assertOk(label: string, error: any) {
  if (!error) return;
  console.error(`[morning-brief] falha em ${label}`, error?.message ?? error);
  throw new Error("Não foi possível montar o Morning Brief agora.");
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function buildMorningBrief(
  supabase: any,
  ownerId: string,
): Promise<MorningBriefData> {
  const hoje = localDateOffset(0);
  const desde30d = new Date(Date.now() - 30 * DIA).toISOString();

  const [ordensRes, agendaRes, agendaCfgRes, abertasRes, settingsRes, empresaRes, servicosRes, recovery] = await Promise.all([
    supabase
      .from("ordens_servico")
      .select("id, valor, status, created_at, entregue_em")
      .eq("owner_id", ownerId)
      .eq("status", "entregue")
      .gte("entregue_em", desde30d)
      .limit(5000),
    supabase
      .from("agendamentos")
      .select("id, status, hora_agendada")
      .eq("owner_id", ownerId)
      .eq("data_agendada", hoje)
      .limit(1000),
    supabase
      .from("agenda_config")
      .select("hora_inicio, hora_fim, intervalo_min, capacidade_simultanea, dias_semana")
      .eq("owner_id", ownerId)
      .maybeSingle(),
    supabase
      .from("ordens_servico")
      .select("id, status")
      .eq("owner_id", ownerId)
      .in("status", ["aguardando", "em_lavagem", "finalizacao", "pronto"])
      .limit(1000),
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
    supabase
      .from("servicos")
      .select("preco_padrao")
      .eq("owner_id", ownerId)
      .eq("ativo", true),
    buildRecoveryEngineData(supabase, ownerId),
  ]);

  assertOk("ordens_servico", ordensRes.error);
  assertOk("agendamentos", agendaRes.error);
  assertOk("agenda_config", agendaCfgRes.error);
  assertOk("ordens_abertas", abertasRes.error);
  assertOk("tenant_ai_settings", settingsRes.error);
  assertOk("empresa", empresaRes.error);
  assertOk("servicos", servicosRes.error);

  const dias7 = new Set(Array.from({ length: 7 }, (_, i) => localDateOffset(-(i + 1))));
  const dias7Anterior = new Set(Array.from({ length: 7 }, (_, i) => localDateOffset(-(i + 8))));
  const ordens = (ordensRes.data ?? []) as Array<{
    valor?: number | string | null;
    created_at?: string | null;
    entregue_em?: string | null;
  }>;

  let receita7d = 0;
  let receita7dAnterior = 0;
  let quantidade7d = 0;
  let quantidade7dAnterior = 0;
  for (const ordem of ordens) {
    const data = ordem.entregue_em ?? ordem.created_at;
    if (!data) continue;
    const key = localDateKey(new Date(data));
    const valor = Number(ordem.valor ?? 0);
    if (dias7.has(key)) {
      receita7d += valor;
      quantidade7d += 1;
    } else if (dias7Anterior.has(key)) {
      receita7dAnterior += valor;
      quantidade7dAnterior += 1;
    }
  }
  receita7d = round2(receita7d);
  receita7dAnterior = round2(receita7dAnterior);
  const variacaoReceita7d = receita7dAnterior > 0
    ? round2((receita7d - receita7dAnterior) / receita7dAnterior)
    : null;

  // Mesma regra usada pela Central do Dia para valorar capacidade ociosa.
  const capacityTicket = calculateCapacityTicket(ordens, (servicosRes.data ?? []) as any[]);
  const ticketMedioCapacidade = capacityTicket.value;

  const agendaAtiva = ((agendaRes.data ?? []) as any[]).filter((a) => isActiveAppointment(a.status));
  const cfg = agendaCfgRes.data as any;
  const inicio = hmToMinutes(cfg?.hora_inicio ?? "08:00");
  const fim = hmToMinutes(cfg?.hora_fim ?? "18:00");
  const intervalo = Math.max(15, Number(cfg?.intervalo_min ?? 60));
  const simultanea = Math.max(1, Number(cfg?.capacidade_simultanea ?? 1));
  const diasSemana = (cfg?.dias_semana ?? []) as number[];
  const abertoHoje = !cfg || diasSemana.length === 0 || diasSemana.includes(localDayOfWeek());
  const agoraMin = localTimeMinutes();

  const ocupacaoPorSlot = new Map<number, number>();
  for (const a of agendaAtiva) {
    const minutos = hmToMinutes(a.hora_agendada);
    const slot = inicio + Math.floor(Math.max(0, minutos - inicio) / intervalo) * intervalo;
    ocupacaoPorSlot.set(slot, (ocupacaoPorSlot.get(slot) ?? 0) + 1);
  }

  let capacidadeHoje = 0;
  let horariosLivresHoje = 0;
  if (abertoHoje && fim > inicio) {
    const primeiroSlot = agoraMin <= inicio
      ? inicio
      : inicio + Math.ceil((agoraMin - inicio) / intervalo) * intervalo;
    for (let slot = inicio; slot + intervalo <= fim; slot += intervalo) {
      capacidadeHoje += simultanea;
      if (slot < primeiroSlot) continue;
      horariosLivresHoje += Math.max(0, simultanea - (ocupacaoPorSlot.get(slot) ?? 0));
    }
  }
  const ocupacaoHoje = capacidadeHoje > 0 ? round2(agendaAtiva.length / capacidadeHoje) : null;
  const veiculosProntos = ((abertasRes.data ?? []) as any[]).filter((o) => o.status === "pronto").length;

  const recoveryAlta = recovery.candidatos.filter((c) => c.prioridade === "alta");
  const recoveryValorEsperado = round2(recoveryAlta.reduce((s, c) => s + c.valorEsperado, 0));

  const itens: MorningBriefItem[] = [];

  if (recoveryAlta.length > 0) {
    itens.push({
      id: "recovery",
      tipo: "oportunidade",
      titulo: `${recoveryAlta.length} cliente${recoveryAlta.length === 1 ? "" : "s"} merece${recoveryAlta.length === 1 ? "" : "m"} prioridade de recuperação`,
      detalhe: `O histórico individual indica atraso de retorno. O valor esperado desses contatos é ${brl(recoveryValorEsperado)} — estimativa, não receita garantida.`,
      metrica: brl(recoveryValorEsperado),
      impactoEstimado: recoveryValorEsperado,
      acaoLabel: "Ver Recovery",
      acaoRota: "/oportunidades",
    });
  }

  if (abertoHoje && capacidadeHoje > 0 && horariosLivresHoje > 0) {
    const potencialAgenda = round2(horariosLivresHoje * ticketMedioCapacidade);
    const fonteTicket = capacityTicket.source === "delivered_30d"
      ? "ticket médio das OS entregues nos últimos 30 dias"
      : capacityTicket.source === "active_services"
        ? "média dos serviços ativos"
        : "referência inicial de ticket";
    itens.push({
      id: "agenda",
      tipo: ocupacaoHoje !== null && ocupacaoHoje < 0.5 ? "atencao" : "oportunidade",
      titulo: `${horariosLivresHoje} ${horariosLivresHoje === 1 ? "horário ainda está livre" : "horários ainda estão livres"} hoje`,
      detalhe: `${agendaAtiva.length} agendamentos ocupam ${Math.round((ocupacaoHoje ?? 0) * 100)}% da capacidade configurada. Os espaços ainda vendáveis representam até ${brl(potencialAgenda)} pelo ${fonteTicket}.`,
      metrica: `${Math.round((ocupacaoHoje ?? 0) * 100)}% ocupado`,
      impactoEstimado: potencialAgenda,
      acaoLabel: "Abrir agenda",
      acaoRota: "/agendamentos",
    });
  }

  if (veiculosProntos > 0) {
    itens.push({
      id: "prontos",
      tipo: "atencao",
      titulo: `${veiculosProntos} veículo${veiculosProntos === 1 ? " está" : "s estão"} pronto${veiculosProntos === 1 ? "" : "s"} para entrega`,
      detalhe: "Vale concluir a entrega e liberar capacidade operacional antes de acumular novos atendimentos.",
      metrica: `${veiculosProntos} pronto${veiculosProntos === 1 ? "" : "s"}`,
      impactoEstimado: null,
      acaoLabel: "Abrir fila",
      acaoRota: "/fila",
    });
  }

  if (variacaoReceita7d !== null && Math.abs(variacaoReceita7d) >= 0.1) {
    const subiu = variacaoReceita7d > 0;
    const amostraConfiavel = quantidade7d >= 3 && quantidade7dAnterior >= 3;
    const titulo = amostraConfiavel
      ? `Receita dos últimos 7 dias ${subiu ? "subiu" : "caiu"} ${Math.abs(Math.round(variacaoReceita7d * 100))}%`
      : `Receita recente ficou ${subiu ? "acima" : "abaixo"} do período anterior`;
    const detalheAmostra = amostraConfiavel
      ? ""
      : ` A amostra ainda é pequena (${quantidade7d} OS contra ${quantidade7dAnterior}), então trate isso como sinal e não como tendência consolidada.`;
    itens.push({
      id: "receita-7d",
      tipo: subiu ? "positivo" : "atencao",
      titulo,
      detalhe: `${brl(receita7d)} nos 7 dias completos mais recentes contra ${brl(receita7dAnterior)} nos 7 dias anteriores.${detalheAmostra}`,
      metrica: brl(receita7d),
      impactoEstimado: null,
      acaoLabel: subiu ? null : "Ver oportunidades",
      acaoRota: subiu ? null : "/oportunidades",
    });
  }

  if (itens.length < 3) {
    if (!abertoHoje) {
      itens.push({
        id: "fechado",
        tipo: "info",
        titulo: "Hoje está configurado como dia fechado",
        detalhe: "Use o dia para preparar agenda, campanhas e acompanhar clientes que precisam retornar.",
        metrica: null,
        impactoEstimado: null,
        acaoLabel: "Ver agenda",
        acaoRota: "/agendamentos",
      });
    } else if (capacidadeHoje > 0 && horariosLivresHoje === 0) {
      itens.push({
        id: "agenda-cheia",
        tipo: "positivo",
        titulo: "Agenda de hoje não tem mais espaços vendáveis",
        detalhe: `${agendaAtiva.length} agendamentos estão registrados e não há mais slots disponíveis a partir do horário atual.`,
        metrica: "sem vagas",
        impactoEstimado: null,
        acaoLabel: null,
        acaoRota: null,
      });
    }
  }

  const prioridade = { atencao: 0, oportunidade: 1, positivo: 2, info: 3 } as const;
  itens.sort((a, b) => prioridade[a.tipo] - prioridade[b.tipo] || (b.impactoEstimado ?? 0) - (a.impactoEstimado ?? 0));
  const itensFinais = itens.slice(0, 4);

  const bc = ((settingsRes.data as any)?.business_context ?? {}) as BusinessContext;
  const empresa = (empresaRes.data ?? null) as any;
  const contexto = mergeEmpresaIntoContext(bc, empresa);
  const tom = ((settingsRes.data as any)?.preferred_tone as string | null) ?? contexto.tom_de_voz ?? null;
  const pack = buildSkillContext("morning_brief", {
    contexto,
    empresa,
    tom,
    operacional: {
      receita7d,
      agendamentosHoje: agendaAtiva.length,
      capacidadeHoje,
      horariosLivresHoje,
      ticketMedioCapacidade,
      recoveryAltaPrioridade: recoveryAlta.length,
      recoveryValorEsperado,
    },
  });

  const atencoes = itensFinais.filter((i) => i.tipo === "atencao").length;
  const oportunidades = itensFinais.filter((i) => i.tipo === "oportunidade").length;
  const resumo = atencoes > 0
    ? `${atencoes} ponto${atencoes === 1 ? "" : "s"} pede${atencoes === 1 ? "" : "m"} atenção hoje${oportunidades ? ` e há ${oportunidades} oportunidade${oportunidades === 1 ? "" : "s"} de receita` : ""}.`
    : oportunidades > 0
      ? `Encontrei ${oportunidades} oportunidade${oportunidades === 1 ? "" : "s"} prática${oportunidades === 1 ? "" : "s"} para hoje.`
      : "A operação está em dia com os dados disponíveis. Foque em manter o ritmo e registrar os atendimentos.";

  return {
    dataLocal: hoje,
    geradoEm: new Date().toISOString(),
    titulo: "Seu resumo de hoje",
    resumo,
    itens: itensFinais,
    metricas: {
      receita7d,
      receita7dAnterior,
      variacaoReceita7d,
      ticketMedio7d: round2(ticketMedioCapacidade),
      agendamentosHoje: agendaAtiva.length,
      capacidadeHoje,
      horariosLivresHoje,
      ocupacaoHoje,
      veiculosProntos,
      recoveryAltaPrioridade: recoveryAlta.length,
      recoveryValorEsperado,
    },
    contextoUsado: Array.from(new Set([...Object.keys(pack.identidade), ...Object.keys(pack.regras)])),
    contextoFaltando: pack.faltando,
  };
}
