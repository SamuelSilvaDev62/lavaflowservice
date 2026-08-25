import { mergeEmpresaIntoContext, type BusinessContext } from "@/lib/business-context";
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
  const desde16d = new Date(Date.now() - 16 * DIA).toISOString();

  const [ordensRes, agendaRes, agendaCfgRes, abertasRes, settingsRes, empresaRes, recovery] = await Promise.all([
    supabase
      .from("ordens_servico")
      .select("id, valor, status, created_at, entregue_em")
      .eq("owner_id", ownerId)
      .eq("status", "entregue")
      .gte("created_at", desde16d)
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
    buildRecoveryEngineData(supabase, ownerId),
  ]);

  assertOk("ordens_servico", ordensRes.error);
  assertOk("agendamentos", agendaRes.error);
  assertOk("agenda_config", agendaCfgRes.error);
  assertOk("ordens_abertas", abertasRes.error);
  assertOk("tenant_ai_settings", settingsRes.error);
  assertOk("empresa", empresaRes.error);

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
    }
  }
  receita7d = round2(receita7d);
  receita7dAnterior = round2(receita7dAnterior);
  const variacaoReceita7d = receita7dAnterior > 0
    ? round2((receita7d - receita7dAnterior) / receita7dAnterior)
    : null;
  const ticketMedio7d = quantidade7d > 0 ? round2(receita7d / quantidade7d) : recovery.resumo.ticketMedio;

  const agendaAtiva = ((agendaRes.data ?? []) as any[]).filter((a) => isActiveAppointment(a.status));
  const cfg = agendaCfgRes.data as any;
  const inicio = hmToMinutes(cfg?.hora_inicio ?? "08:00");
  const fim = hmToMinutes(cfg?.hora_fim ?? "18:00");
  const intervalo = Math.max(15, Number(cfg?.intervalo_min ?? 60));
  const simultanea = Math.max(1, Number(cfg?.capacidade_simultanea ?? 1));
  const diasSemana = (cfg?.dias_semana ?? []) as number[];
  const abertoHoje = !cfg || diasSemana.length === 0 || diasSemana.includes(localDayOfWeek());
  let capacidadeHoje = 0;
  if (abertoHoje && fim > inicio) {
    for (let slot = inicio; slot + intervalo <= fim; slot += intervalo) capacidadeHoje += simultanea;
  }
  const horariosLivresHoje = Math.max(0, capacidadeHoje - agendaAtiva.length);
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
    const potencialAgenda = round2(horariosLivresHoje * (ticketMedio7d || recovery.resumo.ticketMedio || 50));
    itens.push({
      id: "agenda",
      tipo: ocupacaoHoje !== null && ocupacaoHoje < 0.5 ? "atencao" : "oportunidade",
      titulo: `${horariosLivresHoje} ${horariosLivresHoje === 1 ? "horário ainda está livre" : "horários ainda estão livres"} hoje`,
      detalhe: `${agendaAtiva.length} agendamentos ocupam ${Math.round((ocupacaoHoje ?? 0) * 100)}% da capacidade configurada. Preencher os espaços pode representar até ${brl(potencialAgenda)} pelo ticket recente.`,
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
    itens.push({
      id: "receita-7d",
      tipo: subiu ? "positivo" : "atencao",
      titulo: `Receita dos últimos 7 dias ${subiu ? "subiu" : "caiu"} ${Math.abs(Math.round(variacaoReceita7d * 100))}%`,
      detalhe: `${brl(receita7d)} nos 7 dias completos mais recentes contra ${brl(receita7dAnterior)} nos 7 dias anteriores.`,
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
        titulo: "Agenda de hoje está cheia",
        detalhe: `${agendaAtiva.length} agendamentos ocupam toda a capacidade configurada para o dia.`,
        metrica: "100% ocupado",
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
      recoveryAltaPrioridade: recoveryAlta.length,
      recoveryValorEsperado,
    },
  });

  const atencoes = itensFinais.filter((i) => i.tipo === "atencao").length;
  const oportunidades = itensFinais.filter((i) => i.tipo === "oportunidade").length;
  const nome = pack.identidade.nome_fantasia;
  const titulo = nome ? `Bom dia, ${nome}` : "Morning Brief";
  const resumo = atencoes > 0
    ? `${atencoes} ponto${atencoes === 1 ? "" : "s"} pede${atencoes === 1 ? "" : "m"} atenção hoje${oportunidades ? ` e há ${oportunidades} oportunidade${oportunidades === 1 ? "" : "s"} de receita` : ""}.`
    : oportunidades > 0
      ? `Encontrei ${oportunidades} oportunidade${oportunidades === 1 ? "" : "s"} prática${oportunidades === 1 ? "" : "s"} para começar o dia.`
      : "A operação está em dia com os dados disponíveis. Foque em manter o ritmo e registrar os atendimentos.";

  return {
    dataLocal: hoje,
    geradoEm: new Date().toISOString(),
    titulo,
    resumo,
    itens: itensFinais,
    metricas: {
      receita7d,
      receita7dAnterior,
      variacaoReceita7d,
      ticketMedio7d: round2(ticketMedio7d),
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
