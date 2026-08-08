import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ DASHBOARD METRICS ============
type TenantRole = "owner" | "admin" | "gerente" | "atendente" | "lavador" | "colaborador";

const ADMIN_ROLES: TenantRole[] = ["owner", "admin"];
const GESTAO_ROLES: TenantRole[] = ["owner", "admin", "gerente"];
const FUNCIONARIO_SAFE_SELECT = [
  "id",
  "owner_id",
  "nome",
  "cargo",
  "telefone",
  "email",
  "avatar_url",
  "ativo",
  "auth_user_id",
  "pin_digits",
  "perm_iniciar_atendimento",
  "perm_finalizar_atendimento",
  "perm_realizar_checklist",
  "perm_ver_apenas_atribuidos",
  "perm_ver_todos_veiculos",
  "especialidades",
  "horario_inicio",
  "horario_fim",
  "dias_disponiveis",
  "capacidade_por_horario",
  "tempo_medio_servicos",
].join(", ");

function assertTenantRole(role: TenantRole, allowed: TenantRole[], message = "Sem permissao para executar esta acao.") {
  if (!allowed.includes(role)) throw new Error(message);
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayIso() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

const APP_TZ = "America/Sao_Paulo";

function localDateIso(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Dia da semana (0=domingo) no fuso do app. */
function localDayOfWeek() {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: APP_TZ, weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/** "HH:MM" atual no fuso do app. */
function localTimeHm() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}


function agendamentoDateTime(a: any) {
  return new Date(`${a.data_agendada}T${String(a.hora_agendada ?? "00:00").slice(0, 5)}:00`);
}

function isActiveStatus(status: string) {
  return !["concluido", "cancelado", "nao_compareceu"].includes(status);
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

async function hashSecret(value: string) {
  const { randomBytes, scryptSync } = await import("node:crypto");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function verifySecret(value: string, stored?: string | null) {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const { scryptSync, timingSafeEqual } = await import("node:crypto");
  const [, salt, expected] = parts;
  const actual = scryptSync(value, salt, 32);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}

async function tokenHash(token: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}

async function newSessionToken() {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(32).toString("hex");
}

function minutesToTime(mins: number) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export const getDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [{ data: ordensMes }, { data: ordensLast }, { data: assinaturas }, { data: clientes }, { data: ordensAll }] = await Promise.all([
      supabase.from("ordens_servico").select("id, valor, cliente_id, status, created_at, entregue_em").gte("created_at", startOfMonth).eq("owner_id", ownerId),
      supabase.from("ordens_servico").select("id, valor, cliente_id").gte("created_at", startOfLastMonth).lte("created_at", endOfLastMonth).eq("owner_id", ownerId),
      supabase.from("assinaturas_clientes").select("id, plano_id, status, planos_assinatura:plano_id(valor_mensal)").eq("owner_id", ownerId).eq("status", "ativa"),
      supabase.from("clientes").select("id, pontos_saldo, created_at").eq("owner_id", ownerId),
      supabase.from("ordens_servico").select("cliente_id, created_at, valor, servico_id").gte("created_at", ninetyDaysAgo).eq("owner_id", ownerId),
    ]);

    const faturamentoMes = (ordensMes ?? []).reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const faturamentoLast = (ordensLast ?? []).reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const crescimento = faturamentoLast > 0 ? (faturamentoMes - faturamentoLast) / faturamentoLast : 0;

    const mrr = (assinaturas ?? []).reduce((s, a: any) => s + Number(a.planos_assinatura?.valor_mensal ?? 0), 0);
    const assinantes = (assinaturas ?? []).length;

    const lavagensMes = (ordensMes ?? []).length;
    const ticketMedio = lavagensMes ? faturamentoMes / lavagensMes : 0;

    // Retenção: clientes que voltaram nos últimos 90d
    const ativos = new Set((ordensAll ?? []).map((o) => o.cliente_id));
    const recentes = new Set((ordensAll ?? []).filter((o) => o.created_at >= thirtyDaysAgo).map((o) => o.cliente_id));
    const retencao = ativos.size ? recentes.size / ativos.size : 0;

    // Clientes inativos (sem OS há +30d)
    const totalClientes = (clientes ?? []).length;
    const inativos = totalClientes - ativos.size;

    // Receita por dia da semana (últimos 30d)
    const porDia = [0, 0, 0, 0, 0, 0, 0];
    (ordensMes ?? []).forEach((o) => {
      const d = new Date(o.created_at).getDay();
      porDia[d] += Number(o.valor ?? 0);
    });

    // Série 14 dias
    const serie: { dia: string; valor: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ymd = d.toISOString().slice(0, 10);
      const total = (ordensAll ?? [])
        .filter((o) => o.created_at.slice(0, 10) === ymd)
        .reduce((s, o) => s + Number(o.valor ?? 0), 0);
      serie.push({ dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), valor: total });
    }

    // Novos clientes no mês
    const novosClientesMes = (clientes ?? []).filter((c) => c.created_at >= startOfMonth).length;

    // Receita recuperável = clientes inativos (>30d) × ticket médio estimado
    const ticketEstimado = ticketMedio || 50;
    const receitaRecuperavel = inativos * ticketEstimado;

    // Score de saúde do negócio (0-100)
    const sRetencao = retencao * 40;
    const sCrescimento = Math.max(0, Math.min(30, (crescimento + 0.1) * 150));
    const sMrr = mrr > 0 ? 15 : 0;
    const sTicket = ticketMedio >= 40 ? 15 : (ticketMedio / 40) * 15;
    const scoreSaude = Math.round(Math.max(0, Math.min(100, sRetencao + sCrescimento + sMrr + sTicket)));

    // Resumo do Assistente — 1 frase de impacto
    const fmtBrl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    let resumoAssistente = "Cadastre clientes e ordens para receber recomendações inteligentes.";
    if (lavagensMes > 0) {
      if (receitaRecuperavel > 0 && inativos >= 3) {
        resumoAssistente = `Você tem ${inativos} clientes inativos — recuperar metade vale ${fmtBrl(receitaRecuperavel * 0.5)} esse mês.`;
      } else if (crescimento < 0) {
        resumoAssistente = `Seu faturamento caiu ${Math.abs(crescimento * 100).toFixed(0)}% vs mês passado. Veja oportunidades para reagir.`;
      } else if (mrr === 0 && totalClientes >= 5) {
        resumoAssistente = `Você ainda não tem receita recorrente. Criar 1 plano de assinatura pode transformar seu mês.`;
      } else {
        resumoAssistente = `Tudo no rumo certo — faturamento ${crescimento >= 0 ? "subiu" : "caiu"} ${Math.abs(crescimento * 100).toFixed(0)}% e você tem ${assinantes} assinantes ativos.`;
      }
    }

    return {
      faturamentoMes, faturamentoLast, crescimento, mrr, assinantes,
      lavagensMes, ticketMedio, retencao, totalClientes, inativos,
      novosClientesMes, receitaRecuperavel, scoreSaude, resumoAssistente,
      porDia, serie,
    };
  });

export const getDashboardOperacional = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const hoje = localDateIso();
    const now = new Date();
    const startMonth30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [{ data: agendamentos }, { data: ordens }, { data: ordensFinalizadas }, { data: funcionarios }, { data: ordensEntregues30 }, { data: agendaCfg }] = await Promise.all([
      supabase.from("agendamentos")
        .select(`id, data_agendada, hora_agendada, status, leva_traz, endereco_retirada, endereco_devolucao,
                 horario_retirada, horario_devolucao, taxa_leva_traz, cliente_id, servico_id, funcionario_id,
                 clientes:cliente_id(nome, telefone), veiculos:veiculo_id(placa, marca, modelo, cor, vehicle_year),
                 servicos:servico_id(nome, preco_padrao), funcionarios:funcionario_id(nome)`)
        .eq("owner_id", ownerId)
        .eq("data_agendada", hoje)
        .order("hora_agendada", { ascending: true }),
      supabase.from("ordens_servico")
        .select(`id, status, valor, iniciado_em, finalizado_em, entregue_em, created_at, cliente_id, servico_id, funcionario_id,
                 clientes:cliente_id(nome), veiculos:veiculo_id(placa, marca, modelo, cor, vehicle_year), servicos:servico_id(nome), funcionarios:funcionario_id(nome)`)
        .eq("owner_id", ownerId)
        .in("status", ["aguardando", "em_lavagem", "finalizacao", "pronto"]),
      supabase.from("ordens_servico")
        .select("id, status, valor, finalizado_em, entregue_em")
        .eq("owner_id", ownerId)
        .in("status", ["pronto", "entregue"])
        .or(`finalizado_em.gte.${startOfTodayIso()},entregue_em.gte.${startOfTodayIso()}`),
      supabase.from("funcionarios")
        .select("id, nome, capacidade_por_horario, ativo")
        .eq("owner_id", ownerId)
        .eq("ativo", true),
      supabase.from("ordens_servico")
        .select("valor")
        .eq("owner_id", ownerId)
        .eq("status", "entregue")
        .gte("entregue_em", startMonth30),
      supabase.from("agenda_config")
        .select("hora_inicio, hora_fim, intervalo_min, capacidade_simultanea, dias_semana")
        .eq("owner_id", ownerId)
        .maybeSingle(),
    ]);


    const agHoje = agendamentos ?? [];
    const osAbertas = ordens ?? [];
    const previstosAgenda = agHoje
      .filter((a: any) => isActiveStatus(a.status))
      .reduce((s: number, a: any) => s + Number(a.servicos?.preco_padrao ?? 0) + Number(a.taxa_leva_traz ?? 0), 0);
    const faturamentoAberto = osAbertas.reduce((s: number, o: any) => s + Number(o.valor ?? 0), 0);

    // Agenda do dia (fuso do app): todos os ativos, ordenados por hora, com marcacoes.
    const nowHm = localTimeHm();
    const nowMinutes = Number(nowHm.slice(0, 2)) * 60 + Number(nowHm.slice(3, 5));
    const hmToMinutes = (v: any) => {
      const s = String(v ?? "00:00").slice(0, 5);
      return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    };
    const agendaAtiva = agHoje
      .filter((a: any) => isActiveStatus(a.status))
      .sort((a: any, b: any) => hmToMinutes(a.hora_agendada) - hmToMinutes(b.hora_agendada))
      .map((a: any) => {
        const delta = hmToMinutes(a.hora_agendada) - nowMinutes;
        return {
          ...a,
          minutos_para_inicio: delta,
          atrasado: delta < -5 && !["concluido", "entregue"].includes(a.status),
          proximo: delta >= -5 && delta <= 60 && ["agendado", "confirmado"].includes(a.status),
        };
      });
    const levaTrazProximos = agHoje.filter((a: any) => {
      if (!a.leva_traz || !a.horario_retirada || !isActiveStatus(a.status)) return false;
      const diffMin = hmToMinutes(a.horario_retirada) - nowMinutes;
      return diffMin >= 0 && diffMin <= 90;
    });


    const ocupacaoPorFunc = new Map<string, number>();
    agHoje.filter((a: any) => isActiveStatus(a.status) && a.funcionario_id).forEach((a: any) => {
      ocupacaoPorFunc.set(a.funcionario_id, (ocupacaoPorFunc.get(a.funcionario_id) ?? 0) + 1);
    });
    const funcProxCapacidade = (funcionarios ?? [])
      .map((f: any) => ({
        id: f.id,
        nome: f.nome,
        ocupacao: ocupacaoPorFunc.get(f.id) ?? 0,
        capacidade: Math.max(1, Number(f.capacidade_por_horario ?? 1)),
      }))
      .filter((f: any) => f.ocupacao >= f.capacidade)
      .slice(0, 3);

    // Ticket médio (últimos 30 dias, entregues); fallback 50.
    const entregues30 = ordensEntregues30 ?? [];
    const ticketMedio = entregues30.length
      ? entregues30.reduce((s: number, r: any) => s + Number(r.valor ?? 0), 0) / entregues30.length
      : 50;

    // Capacidade do dia a partir de agenda_config; fallback 8.
    const dow = new Date().getDay();
    let capacidadeDia = 8;
    if (agendaCfg) {
      const diasSemana = (agendaCfg.dias_semana ?? []) as number[];
      if (diasSemana.length === 0 || diasSemana.includes(dow)) {
        const [hi, mi] = String(agendaCfg.hora_inicio ?? "08:00").split(":").map(Number);
        const [hf, mf] = String(agendaCfg.hora_fim ?? "18:00").split(":").map(Number);
        const minutos = Math.max(0, (hf * 60 + (mf || 0)) - (hi * 60 + (mi || 0)));
        const intervalo = Math.max(15, Number(agendaCfg.intervalo_min ?? 60));
        const cap = Math.max(1, Number(agendaCfg.capacidade_simultanea ?? 1));
        capacidadeDia = Math.max(0, Math.floor(minutos / intervalo)) * cap;
      } else {
        capacidadeDia = 0;
      }
    }
    const agendadosAtivos = agHoje.filter((a: any) => isActiveStatus(a.status)).length;
    const horariosLivres = Math.max(0, capacidadeDia - agendadosAtivos);
    const potencialFaturamento = horariosLivres * ticketMedio;

    const alertas = [
      levaTrazProximos.length > 0 ? {
        tipo: "leva_traz",
        prioridade: "alta",
        titulo: "Retiradas próximas",
        mensagem: `${levaTrazProximos.length} solicitação de Leva e Traz exige atenção nos próximos 90 minutos.`,
        rota: "/agendamentos",
      } : null,
      osAbertas.filter((o: any) => o.status === "pronto").length > 0 ? {
        tipo: "pronto",
        prioridade: "alta",
        titulo: "Veículos prontos para entrega",
        mensagem: `${osAbertas.filter((o: any) => o.status === "pronto").length} veículo(s) aguardando entrega ao cliente.`,
        rota: "/fila",
      } : null,
      funcProxCapacidade.length > 0 ? {
        tipo: "capacidade",
        prioridade: "media",
        titulo: "Equipe próxima da capacidade",
        mensagem: `${funcProxCapacidade.map((f: any) => f.nome).join(", ")} já está com agenda cheia.`,
        rota: "/equipe",
      } : null,
    ].filter(Boolean);

    return {
      cards: {
        agendamentosHoje: agHoje.length,
        veiculosEmAtendimento: osAbertas.filter((o: any) => ["em_lavagem", "finalizacao"].includes(o.status)).length,
        servicosPendentes: osAbertas.filter((o: any) => ["aguardando", "pronto"].includes(o.status)).length,
        previsaoFaturamentoDia: previstosAgenda + faturamentoAberto,
        finalizadosHoje: (ordensFinalizadas ?? []).length,
        ticketMedio,
        capacidadeDia,
        horariosLivres,
        potencialFaturamento,
      },
      agendaHoje: proximos,
      veiculosEmAtendimento: osAbertas.filter((o: any) => ["em_lavagem", "finalizacao", "pronto"].includes(o.status)).slice(0, 6),
      alertas,
    };
  });


export const getMissaoDoDia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const hoje = localDateIso();
    const amanha = localDateIso(1);
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const fortyFiveAgo = new Date(Date.now() - 45 * 86_400_000).toISOString();

    const [
      { data: clientes },
      { data: ordens90 },
      { data: ordensMes },
      { data: agendamentosHoje },
      { data: agendamentosAmanha },
      { data: configRows },
      { data: servicos },
      { data: assinaturas },
      { data: planos },
      { data: recompensas },
    ] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, pontos_saldo, created_at").eq("owner_id", ownerId),
      supabase.from("ordens_servico")
        .select("id, cliente_id, servico_id, valor, created_at, servicos:servico_id(nome)")
        .eq("owner_id", ownerId)
        .gte("created_at", ninetyAgo),
      supabase.from("ordens_servico")
        .select("id, cliente_id, valor, created_at")
        .eq("owner_id", ownerId)
        .gte("created_at", startMonth),
      supabase.from("agendamentos")
        .select("id, data_agendada, hora_agendada, status")
        .eq("owner_id", ownerId)
        .eq("data_agendada", hoje),
      supabase.from("agendamentos")
        .select("id, data_agendada, hora_agendada, status")
        .eq("owner_id", ownerId)
        .eq("data_agendada", amanha),
      supabase.from("agenda_config")
        .select("hora_inicio, hora_fim, intervalo_min, capacidade_simultanea, dias_semana")
        .eq("owner_id", ownerId)
        .maybeSingle(),
      supabase.from("servicos").select("id, nome, preco_padrao, disponivel_online").eq("owner_id", ownerId),
      supabase.from("assinaturas_clientes").select("cliente_id, status").eq("owner_id", ownerId),
      supabase.from("planos_assinatura").select("id, nome, valor_mensal, ativo").eq("owner_id", ownerId).eq("ativo", true).order("valor_mensal"),
      supabase.from("recompensas").select("nome, custo_pontos, ativo").eq("owner_id", ownerId).eq("ativo", true).order("custo_pontos"),
    ]);

    const clientesRows = clientes ?? [];
    const ordensRows = ordens90 ?? [];
    const ordensMesRows = ordensMes ?? [];
    const receita90 = ordensRows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
    const ticketMedio = ordensRows.length ? receita90 / ordensRows.length : 50;
    const faturamentoMes = ordensMesRows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);

    const byCliente = new Map<string, { visitas: number; total: number; ultima: string | null; nome: string; telefone: string | null }>();
    clientesRows.forEach((cliente: any) => {
      byCliente.set(cliente.id, {
        visitas: 0,
        total: 0,
        ultima: null,
        nome: cliente.nome ?? "Cliente",
        telefone: cliente.telefone ?? null,
      });
    });
    ordensRows.forEach((ordem: any) => {
      if (!ordem.cliente_id) return;
      const cur = byCliente.get(ordem.cliente_id) ?? { visitas: 0, total: 0, ultima: null, nome: "Cliente", telefone: null };
      cur.visitas += 1;
      cur.total += Number(ordem.valor ?? 0);
      if (!cur.ultima || ordem.created_at > cur.ultima) cur.ultima = ordem.created_at;
      byCliente.set(ordem.cliente_id, cur);
    });

    const clientesEmRisco = Array.from(byCliente.entries())
      .map(([id, row]) => ({
        id,
        nome: row.nome,
        telefone: row.telefone,
        visitas: row.visitas,
        total: roundMoney(row.total),
        diasSemRetornar: row.ultima ? Math.floor((Date.now() - new Date(row.ultima).getTime()) / 86_400_000) : 999,
      }))
      .filter((row) => row.diasSemRetornar >= 45)
      .sort((a, b) => b.total - a.total || b.diasSemRetornar - a.diasSemRetornar)
      .slice(0, 5);

    const assinaturaClientes = new Set((assinaturas ?? []).filter((row: any) => row.status === "ativa").map((row: any) => row.cliente_id));
    const candidatosAssinatura = Array.from(byCliente.entries())
      .map(([id, row]) => ({ id, nome: row.nome, visitas: row.visitas, total: roundMoney(row.total) }))
      .filter((row) => row.visitas >= 4 && !assinaturaClientes.has(row.id))
      .sort((a, b) => b.visitas - a.visitas || b.total - a.total)
      .slice(0, 5);

    const servicosById = new Map((servicos ?? []).map((row: any) => [row.id, row]));
    const servicoStats = new Map<string, { id: string; nome: string; qtd: number; receita: number }>();
    ordensRows.forEach((ordem: any) => {
      const id = ordem.servico_id ?? "sem-servico";
      const nome = ordem.servicos?.nome ?? servicosById.get(id)?.nome ?? "Serviço";
      const cur = servicoStats.get(id) ?? { id, nome, qtd: 0, receita: 0 };
      cur.qtd += 1;
      cur.receita += Number(ordem.valor ?? 0);
      servicoStats.set(id, cur);
    });
    const servicoParaDivulgar = Array.from(servicoStats.values())
      .sort((a, b) => (b.receita / Math.max(1, b.qtd)) - (a.receita / Math.max(1, a.qtd)))
      [0] ?? (servicos ?? [])[0] ?? null;

    const cfg = configRows ?? { hora_inicio: "08:00", hora_fim: "18:00", intervalo_min: 30, capacidade_simultanea: 1, dias_semana: [1,2,3,4,5,6] };
    const [hI, mI] = String(cfg.hora_inicio ?? "08:00").slice(0, 5).split(":").map(Number);
    const [hF, mF] = String(cfg.hora_fim ?? "18:00").slice(0, 5).split(":").map(Number);
    const intervalo = Number(cfg.intervalo_min ?? 30);
    const capacidade = Math.max(1, Number(cfg.capacidade_simultanea ?? 1));
    const ocupHoje = new Map<string, number>();
    (agendamentosHoje ?? [])
      .filter((row: any) => isActiveStatus(row.status))
      .forEach((row: any) => {
        const hora = String(row.hora_agendada ?? "").slice(0, 5);
        ocupHoje.set(hora, (ocupHoje.get(hora) ?? 0) + 1);
      });

    const slotsLivres: Array<{ data: string; hora: string; vagas: number }> = [];
    const inicio = hI * 60 + mI;
    const fim = hF * 60 + mF;
    const agoraMins = now.getHours() * 60 + now.getMinutes();
    for (let mins = inicio; mins < fim; mins += intervalo) {
      if (mins < agoraMins) continue;
      const hora = minutesToTime(mins);
      const vagas = capacidade - (ocupHoje.get(hora) ?? 0);
      if (vagas > 0) slotsLivres.push({ data: hoje, hora, vagas });
    }
    if (slotsLivres.length < 3) {
      const ocupAmanha = new Map<string, number>();
      (agendamentosAmanha ?? [])
        .filter((row: any) => isActiveStatus(row.status))
        .forEach((row: any) => {
          const hora = String(row.hora_agendada ?? "").slice(0, 5);
          ocupAmanha.set(hora, (ocupAmanha.get(hora) ?? 0) + 1);
        });
      for (let mins = inicio; mins < fim && slotsLivres.length < 5; mins += intervalo) {
        const hora = minutesToTime(mins);
        const vagas = capacidade - (ocupAmanha.get(hora) ?? 0);
        if (vagas > 0) slotsLivres.push({ data: amanha, hora, vagas });
      }
    }

    const menorRecompensa = Number((recompensas ?? [])[0]?.custo_pontos ?? 0);
    const clientesComRecompensa = menorRecompensa
      ? clientesRows.filter((cliente: any) => Number(cliente.pontos_saldo ?? 0) >= menorRecompensa).length
      : 0;
    const planoBase = (planos ?? [])[0];
    const receitaRecuperavel = roundMoney(clientesEmRisco.length * ticketMedio);
    const potencialAssinaturas = roundMoney(candidatosAssinatura.length * Number(planoBase?.valor_mensal ?? 0));
    const potencialHoje = roundMoney(receitaRecuperavel + potencialAssinaturas);

    const acoes: Array<{
      id: string;
      prioridade: "alta" | "media" | "baixa";
      titulo: string;
      detalhe: string;
      impactoEstimado: number;
      tempoMin: number;
      rota: string;
      cta: string;
      whatsapp?: string;
    }> = [];

    if (clientesEmRisco.length > 0) {
      const alvo = clientesEmRisco[0];
      acoes.push({
        id: "recuperar-clientes",
        prioridade: clientesEmRisco.length >= 3 ? "alta" : "media",
        titulo: `Chamar ${clientesEmRisco.length} cliente(s) em risco`,
        detalhe: `${alvo.nome} está há ${alvo.diasSemRetornar} dias sem voltar. Potencial estimado por retorno: ${roundMoney(ticketMedio).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        impactoEstimado: receitaRecuperavel,
        tempoMin: Math.min(12, Math.max(4, clientesEmRisco.length * 3)),
        rota: "/clientes/inativos",
        cta: "Ver clientes",
        whatsapp: `Olá ${alvo.nome}! Sentimos sua falta por aqui. Temos horários disponíveis e seria um prazer cuidar do seu veículo novamente. Quer agendar uma lavagem esta semana?`,
      });
    }

    if (candidatosAssinatura.length > 0 && planoBase) {
      const alvo = candidatosAssinatura[0];
      acoes.push({
        id: "oferecer-assinatura",
        prioridade: "media",
        titulo: `Oferecer assinatura para ${candidatosAssinatura.length} cliente(s) frequente(s)`,
        detalhe: `${alvo.nome} teve ${alvo.visitas} visita(s) recentes e ainda não possui assinatura ativa.`,
        impactoEstimado: potencialAssinaturas,
        tempoMin: 5,
        rota: "/assinaturas",
        cta: "Ver planos",
        whatsapp: `Olá ${alvo.nome}! Vi que você cuida do veículo com frequência. Temos o plano ${planoBase.nome} que pode deixar suas lavagens mais previsíveis. Posso te explicar como funciona?`,
      });
    }

    if (slotsLivres.length > 0) {
      const slot = slotsLivres[0];
      acoes.push({
        id: "preencher-horarios",
        prioridade: "media",
        titulo: "Preencher horário livre",
        detalhe: `${slot.data === hoje ? "Hoje" : "Amanhã"} às ${slot.hora} ainda tem ${slot.vagas} vaga(s).`,
        impactoEstimado: roundMoney(slot.vagas * ticketMedio),
        tempoMin: 3,
        rota: "/agendamentos",
        cta: "Abrir agenda",
      });
    }

    if (servicoParaDivulgar) {
      const nomeServico = servicoParaDivulgar.nome ?? "serviço principal";
      acoes.push({
        id: "divulgar-servico",
        prioridade: "baixa",
        titulo: `Divulgar ${nomeServico}`,
        detalhe: "Serviço com bom potencial de ticket nos dados recentes. Use como oferta principal do dia.",
        impactoEstimado: roundMoney(Number(servicoParaDivulgar.receita ?? (servicoParaDivulgar as any).preco_padrao ?? ticketMedio)),
        tempoMin: 4,
        rota: "/oportunidades",
        cta: "Ver oportunidades",
        whatsapp: `Hoje é um bom dia para cuidar do seu veículo com ${nomeServico}. Temos horários disponíveis. Quer reservar um horário?`,
      });
    }

    if (clientesComRecompensa > 0) {
      acoes.push({
        id: "ativar-fidelidade",
        prioridade: "baixa",
        titulo: `${clientesComRecompensa} cliente(s) com recompensa disponível`,
        detalhe: "Recompensa disponível é um bom motivo para trazer o cliente de volta sem desconto agressivo.",
        impactoEstimado: roundMoney(clientesComRecompensa * ticketMedio),
        tempoMin: 4,
        rota: "/fidelidade",
        cta: "Ver fidelidade",
      });
    }

    const acoesOrdenadas = acoes
      .sort((a, b) => {
        const peso = { alta: 3, media: 2, baixa: 1 };
        return peso[b.prioridade] - peso[a.prioridade] || b.impactoEstimado - a.impactoEstimado;
      })
      .slice(0, 4);

    return {
      titulo: potencialHoje > 0
        ? `Hoje você pode recuperar aproximadamente ${potencialHoje.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
        : "Hoje o foco é manter a operação fluindo e registrar mais dados.",
      subtitulo: acoesOrdenadas.length > 0
        ? "Execute as ações abaixo primeiro. Elas usam dados reais do seu LavaFlow."
        : "Ainda não há sinais suficientes para uma missão financeira confiável.",
      potencialHoje,
      faturamentoMes: roundMoney(faturamentoMes),
      ticketMedio: roundMoney(ticketMedio),
      tempoTotalMin: acoesOrdenadas.reduce((sum, item) => sum + item.tempoMin, 0),
      clientesEmRisco,
      candidatosAssinatura,
      slotsLivres: slotsLivres.slice(0, 5),
      servicoParaDivulgar: servicoParaDivulgar ? {
        nome: servicoParaDivulgar.nome,
        receita: roundMoney(Number(servicoParaDivulgar.receita ?? 0)),
        quantidade: Number(servicoParaDivulgar.qtd ?? 0),
      } : null,
      acoes: acoesOrdenadas,
    };
  });

export const getSaudeNegocio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [
      { data: ordens90 },
      { data: ordensMes },
      { data: ordensMesAnterior },
      { data: clientes },
      { data: assinaturas },
      { data: agendamentos30 },
      { data: funcionarios },
    ] = await Promise.all([
      supabase.from("ordens_servico")
        .select("id, cliente_id, funcionario_id, valor, status, created_at")
        .eq("owner_id", ownerId)
        .gte("created_at", ninetyAgo),
      supabase.from("ordens_servico")
        .select("id, cliente_id, valor, status, created_at")
        .eq("owner_id", ownerId)
        .gte("created_at", startMonth),
      supabase.from("ordens_servico")
        .select("id, cliente_id, valor, status, created_at")
        .eq("owner_id", ownerId)
        .gte("created_at", lastMonthStart)
        .lte("created_at", lastMonthEnd),
      supabase.from("clientes").select("id, created_at").eq("owner_id", ownerId),
      supabase.from("assinaturas_clientes")
        .select("id, cliente_id, status, planos_assinatura:plano_id(valor_mensal)")
        .eq("owner_id", ownerId),
      supabase.from("agendamentos")
        .select("id, status, data_agendada")
        .eq("owner_id", ownerId)
        .gte("data_agendada", thirtyAgo.slice(0, 10)),
      supabase.from("funcionarios").select("id, ativo").eq("owner_id", ownerId),
    ]);

    const ordensRows = ordens90 ?? [];
    const ordensMesRows = ordensMes ?? [];
    const ordensMesAnteriorRows = ordensMesAnterior ?? [];
    const clientesRows = clientes ?? [];
    const assinaturasAtivas = (assinaturas ?? []).filter((row: any) => row.status === "ativa");
    const funcionariosAtivos = (funcionarios ?? []).filter((row: any) => row.ativo);

    const receita90 = ordensRows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
    const receitaMes = ordensMesRows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
    const receitaMesAnterior = ordensMesAnteriorRows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
    const crescimento = receitaMesAnterior > 0 ? (receitaMes - receitaMesAnterior) / receitaMesAnterior : (receitaMes > 0 ? 1 : 0);
    const ticketMedio = ordensRows.length ? receita90 / ordensRows.length : 0;
    const mrr = assinaturasAtivas.reduce((sum: number, row: any) => sum + Number(row.planos_assinatura?.valor_mensal ?? 0), 0);

    const clientesAtivos90 = new Set(ordensRows.map((row: any) => row.cliente_id).filter(Boolean));
    const clientesRecentes30 = new Set(ordensRows.filter((row: any) => row.created_at >= thirtyAgo).map((row: any) => row.cliente_id).filter(Boolean));
    const retencao = clientesAtivos90.size ? clientesRecentes30.size / clientesAtivos90.size : 0;
    const clientesInativos = Math.max(0, clientesRows.length - clientesRecentes30.size);

    const ag30 = agendamentos30 ?? [];
    const cancelados = ag30.filter((row: any) => ["cancelado", "nao_compareceu"].includes(row.status)).length;
    const taxaComparecimento = ag30.length ? (ag30.length - cancelados) / ag30.length : 0;
    const ordensPorFuncionario = funcionariosAtivos.length ? ordensMesRows.length / funcionariosAtivos.length : ordensMesRows.length;

    const fatores = [
      {
        id: "receita",
        label: "Receita",
        valor: Math.round(Math.max(0, Math.min(100, receitaMes > 0 ? 65 + Math.min(35, crescimento * 70) : 0))),
        detalhe: receitaMes > 0
          ? `Faturamento do mês: ${roundMoney(receitaMes).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`
          : "Ainda não há faturamento registrado neste mês.",
      },
      {
        id: "retencao",
        label: "Retenção",
        valor: Math.round(Math.max(0, Math.min(100, retencao * 100))),
        detalhe: `${clientesRecentes30.size} de ${clientesAtivos90.size || clientesRows.length} clientes retornaram recentemente.`,
      },
      {
        id: "ticket",
        label: "Ticket médio",
        valor: Math.round(Math.max(0, Math.min(100, (ticketMedio / 80) * 100))),
        detalhe: `Ticket médio dos últimos 90 dias: ${roundMoney(ticketMedio).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      },
      {
        id: "recorrencia",
        label: "Recorrência",
        valor: Math.round(Math.max(0, Math.min(100, clientesRows.length ? (assinaturasAtivas.length / clientesRows.length) * 220 : 0))),
        detalhe: `${assinaturasAtivas.length} assinatura(s) ativa(s), MRR de ${roundMoney(mrr).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      },
      {
        id: "agenda",
        label: "Agenda",
        valor: Math.round(Math.max(0, Math.min(100, ag30.length ? taxaComparecimento * 100 : 45))),
        detalhe: ag30.length ? `${ag30.length - cancelados} de ${ag30.length} agendamentos seguiram válidos.` : "Poucos agendamentos recentes para medir presença.",
      },
      {
        id: "equipe",
        label: "Equipe",
        valor: Math.round(Math.max(0, Math.min(100, funcionariosAtivos.length ? 55 + Math.min(45, ordensPorFuncionario * 5) : 35))),
        detalhe: funcionariosAtivos.length ? `${funcionariosAtivos.length} colaborador(es) ativo(s), média de ${roundMoney(ordensPorFuncionario)} OS no mês.` : "Cadastre colaboradores para medir produtividade.",
      },
    ];

    const score = Math.round(fatores.reduce((sum, item) => sum + item.valor, 0) / fatores.length);
    const status = score >= 80 ? "excelente" : score >= 65 ? "bom" : score >= 45 ? "atenção" : "crítico";
    const topRiscos = fatores.slice().sort((a, b) => a.valor - b.valor).slice(0, 2);
    const pontosFortes = fatores.slice().sort((a, b) => b.valor - a.valor).slice(0, 2);
    const recomendacoes = topRiscos.map((fator) => {
      const mapa: Record<string, string> = {
        receita: "Preencha horários livres e priorize clientes com maior chance de retorno hoje.",
        retencao: "Execute uma campanha curta para clientes sem retorno nos últimos 45 dias.",
        ticket: "Divulgue um serviço premium ou adicione um opcional na próxima confirmação de reserva.",
        recorrencia: "Ofereça um plano simples para clientes com 4 ou mais visitas recentes.",
        agenda: "Confirme reservas por WhatsApp e reduza cancelamentos/no-show.",
        equipe: "Distribua os próximos serviços por colaborador e revise capacidade por horário.",
      };
      return {
        fator: fator.label,
        acao: mapa[fator.id] ?? "Revise este indicador com atenção.",
      };
    });

    return {
      score,
      status,
      resumo: `Saúde ${status}: ${score}/100. ${topRiscos[0]?.label ?? "Operação"} é o ponto que mais merece atenção agora.`,
      fatores,
      pontosFortes,
      riscos: topRiscos,
      recomendacoes,
      metricas: {
        receitaMes: roundMoney(receitaMes),
        crescimento: roundMoney(crescimento),
        ticketMedio: roundMoney(ticketMedio),
        retencao: roundMoney(retencao),
        mrr: roundMoney(mrr),
        clientesInativos,
        taxaComparecimento: roundMoney(taxaComparecimento),
      },
    };
  });

export const getAlertasOperacionais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const hoje = localDateIso();
    const now = new Date();

    const [{ data: agendamentos }, { data: ordens }, { data: notificacoes }] = await Promise.all([
      supabase.from("agendamentos")
        .select(`id, data_agendada, hora_agendada, status, leva_traz, endereco_retirada, endereco_devolucao,
                 horario_retirada, horario_devolucao, clientes:cliente_id(nome), veiculos:veiculo_id(placa, marca, modelo, cor, vehicle_year)`)
        .eq("owner_id", ownerId)
        .eq("data_agendada", hoje)
        .order("hora_agendada", { ascending: true }),
      supabase.from("ordens_servico")
        .select(`id, status, iniciado_em, finalizado_em, created_at, clientes:cliente_id(nome), veiculos:veiculo_id(placa, marca, modelo, cor, vehicle_year)`)
        .eq("owner_id", ownerId)
        .in("status", ["em_lavagem", "finalizacao", "pronto"]),
      supabase.from("notificacoes")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("ignorada", false)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const derivados = [
      ...(agendamentos ?? []).flatMap((a: any) => {
        const out: any[] = [];
        if (a.leva_traz && a.horario_retirada && isActiveStatus(a.status)) {
          const t = new Date(`${a.data_agendada}T${String(a.horario_retirada).slice(0, 5)}:00`).getTime();
          const diff = (t - now.getTime()) / 60000;
          if (diff >= 0 && diff <= 30) {
            out.push({
              id: `retirada-${a.id}`,
              tipo: "leva_traz_retirada",
              prioridade: "alta",
              titulo: "Retirada programada",
              mensagem: `Buscar o veículo de ${a.clientes?.nome ?? "cliente"} em ${Math.round(diff)} minutos.`,
              rota: "/agendamentos",
              referencia_id: a.id,
              cliente: a.clientes,
              veiculo: a.veiculos,
              status: a.status,
              acao_label: "Abrir agenda",
              created_at: new Date().toISOString(),
            });
          }
        }
        if (a.leva_traz && a.horario_devolucao && isActiveStatus(a.status)) {
          const t = new Date(`${a.data_agendada}T${String(a.horario_devolucao).slice(0, 5)}:00`).getTime();
          const diff = (t - now.getTime()) / 60000;
          if (diff >= 0 && diff <= 30) {
            out.push({
              id: `devolucao-${a.id}`,
              tipo: "leva_traz_devolucao",
              prioridade: "alta",
              titulo: "Devolução programada",
              mensagem: `Devolver o veículo de ${a.clientes?.nome ?? "cliente"} em ${Math.round(diff)} minutos.`,
              rota: "/agendamentos",
              referencia_id: a.id,
              cliente: a.clientes,
              veiculo: a.veiculos,
              status: a.status,
              acao_label: "Abrir agenda",
              created_at: new Date().toISOString(),
            });
          }
        }
        return out;
      }),
      ...(ordens ?? []).flatMap((o: any) => {
        if (o.status === "pronto") {
          return [{
            id: `pronto-${o.id}`,
            tipo: "veiculo_pronto",
            prioridade: "alta",
            titulo: "Veículo pronto para entrega",
            mensagem: `${o.clientes?.nome ?? "Cliente"} já pode ser avisado para retirar o veículo.`,
            rota: "/fila",
            referencia_id: o.id,
            cliente: o.clientes,
            veiculo: o.veiculos,
            status: o.status,
            acao_label: "Avisar cliente",
            created_at: new Date().toISOString(),
          }];
        }
        if (o.iniciado_em) {
          const mins = (now.getTime() - new Date(o.iniciado_em).getTime()) / 60000;
          if (mins >= 180 && o.status !== "pronto") {
            return [{
              id: `atraso-${o.id}`,
              tipo: "servico_atrasado",
              prioridade: "alta",
              titulo: "Serviço possivelmente atrasado",
              mensagem: `${o.clientes?.nome ?? "Cliente"} está em atendimento há ${Math.round(mins)} minutos.`,
              rota: "/fila",
              referencia_id: o.id,
              cliente: o.clientes,
              veiculo: o.veiculos,
              status: o.status,
              acao_label: "Abrir fila",
              created_at: new Date().toISOString(),
            }];
          }
        }
        return [];
      }),
    ];

    return { alertas: [...derivados, ...(notificacoes ?? [])].slice(0, 10) };
  });

export const marcarNotificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    lida: z.boolean().optional(),
    ignorada: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { error } = await supabase.from("notificacoes")
      .update({ lida: data.lida ?? true, ignorada: data.ignorada ?? false })
      .eq("id", data.id)
      .eq("owner_id", ownerId);
    if (error) throw error;
    return { ok: true };
  });

// ============ OPORTUNIDADES ============
export const getOportunidades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const [{ data: clientes }, { data: ordens }] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, pontos_saldo, created_at").eq("owner_id", ownerId),
      supabase.from("ordens_servico").select("id, cliente_id, valor, created_at").gte("created_at", ninetyAgo).eq("owner_id", ownerId).order("created_at", { ascending: false }),
    ]);

    const lastByCliente = new Map<string, string>();
    const countByCliente = new Map<string, number>();
    (ordens ?? []).forEach((o) => {
      if (!lastByCliente.has(o.cliente_id)) lastByCliente.set(o.cliente_id, o.created_at);
      countByCliente.set(o.cliente_id, (countByCliente.get(o.cliente_id) ?? 0) + 1);
    });

    // Ticket médio real (últimos 90d). Fallback razoável quando ainda não há dados.
    const totalReceita = (ordens ?? []).reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const ticketMedio = (ordens && ordens.length > 0) ? totalReceita / ordens.length : 50;

    const oportunidades: Array<{
      id: string; tipo: string; prioridade: number; titulo: string; descricao: string;
      cliente_id: string; cliente_nome: string; telefone: string | null; receitaPotencial: number;
    }> = [];

    (clientes ?? []).forEach((c) => {
      const last = lastByCliente.get(c.id);
      if (!last) return;
      const days = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
      if (days >= 90) {
        oportunidades.push({ id: `r90-${c.id}`, tipo: "reativacao_90", prioridade: 4, titulo: "Cliente sumiu há 90+ dias",
          descricao: `${c.nome} não retorna há ${days} dias. Enviar oferta agressiva.`, cliente_id: c.id, cliente_nome: c.nome, telefone: c.telefone, receitaPotencial: ticketMedio });
      } else if (days >= 60) {
        oportunidades.push({ id: `r60-${c.id}`, tipo: "reativacao_60", prioridade: 3, titulo: "Reativar cliente (60d)",
          descricao: `${c.nome} sem visita há ${days} dias. Cupom recomendado.`, cliente_id: c.id, cliente_nome: c.nome, telefone: c.telefone, receitaPotencial: ticketMedio });
      } else if (days >= 45) {
        oportunidades.push({ id: `r45-${c.id}`, tipo: "reativacao_45", prioridade: 2, titulo: "Cliente em risco (45d)",
          descricao: `${c.nome} começou a se afastar. Lembrete amigável.`, cliente_id: c.id, cliente_nome: c.nome, telefone: c.telefone, receitaPotencial: ticketMedio });
      } else if (days >= 30) {
        oportunidades.push({ id: `r30-${c.id}`, tipo: "reativacao_30", prioridade: 1, titulo: "Tempo de retorno (30d)",
          descricao: `${c.nome} costuma voltar nessa janela. Lembre.`, cliente_id: c.id, cliente_nome: c.nome, telefone: c.telefone, receitaPotencial: ticketMedio });
      }

      const visitas = countByCliente.get(c.id) ?? 0;
      if (visitas >= 4 && c.pontos_saldo < 50) {
        oportunidades.push({ id: `up-${c.id}`, tipo: "upsell_assinatura", prioridade: 3, titulo: "Candidato a assinatura",
          descricao: `${c.nome} já fez ${visitas} lavagens em 90d. Ofereça plano mensal.`, cliente_id: c.id, cliente_nome: c.nome, telefone: c.telefone, receitaPotencial: 120 });
      }
    });

    return { oportunidades: oportunidades.sort((a, b) => b.prioridade - a.prioridade) };
  });

// ============ ASSISTENTE — INSIGHTS ============
export const getInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const sixtyAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const { data: ordens } = await supabase
      .from("ordens_servico")
      .select("id, valor, created_at, cliente_id, servico_id")
      .gte("created_at", sixtyAgo)
      .eq("owner_id", ownerId);

    const insights: Array<{ id: string; tipo: "positivo" | "alerta" | "info"; titulo: string; descricao: string; acao?: string }> = [];

    if (!ordens || ordens.length === 0) {
      insights.push({ id: "no-data", tipo: "info", titulo: "Sem dados suficientes", descricao: "Registre ordens de serviço para receber insights." });
      return { insights };
    }

    // Melhor dia da semana
    const porDia = Array(7).fill(0);
    const labels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    ordens.forEach((o) => { porDia[new Date(o.created_at).getDay()] += Number(o.valor ?? 0); });
    const maxValor = Math.max(...porDia);
    if (maxValor > 0) {
      const melhor = porDia.indexOf(maxValor);
      insights.push({ id: "best-day", tipo: "positivo", titulo: `Seu melhor dia é ${labels[melhor]}`, descricao: `Concentre promoções em ${labels[melhor]} para crescer ainda mais.` });
      const positivos = porDia.filter((v) => v > 0);
      if (positivos.length > 1) {
        const minValor = Math.min(...positivos);
        const pior = porDia.indexOf(minValor);
        if (pior >= 0 && minValor < maxValor * 0.4) {
          insights.push({ id: "weak-day", tipo: "alerta", titulo: `${labels[pior]} está fraco`, descricao: "Considere descontos ou pacotes para movimentar esse dia.", acao: "Criar campanha" });
        }
      }
    }

    // Ticket médio
    const ticket = ordens.reduce((s, o) => s + Number(o.valor ?? 0), 0) / ordens.length;
    insights.push({ id: "ticket", tipo: "info", titulo: `Ticket médio R$ ${ticket.toFixed(2)}`, descricao: "Ofereça serviços complementares para subir esse número." });

    // Top serviços
    const porServico = new Map<string, number>();
    ordens.forEach((o) => o.servico_id && porServico.set(o.servico_id, (porServico.get(o.servico_id) ?? 0) + 1));

    return { insights };
  });

// ============ FILA / KANBAN ============
export type OsStatus = "aguardando" | "em_lavagem" | "finalizacao" | "pronto" | "entregue";

async function getExigeChecklistInicial(supabase: any, ownerId: string) {
  const { data } = await supabase
    .from("empresa")
    .select("exigir_checklist_inicial")
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data?.exigir_checklist_inicial !== false;
}

async function assertPodeIniciarLavagem(supabase: any, ownerId: string, ordemId: string) {
  const obrigatorio = await getExigeChecklistInicial(supabase, ownerId);
  if (!obrigatorio) return;
  const { data: ordem } = await supabase
    .from("ordens_servico")
    .select("checklist_inicial_status")
    .eq("id", ordemId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (ordem?.checklist_inicial_status !== "concluido") {
    throw new Error("Conclua o checklist inicial antes de iniciar o atendimento.");
  }
}

export const getFila = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`
        id, status, posicao, valor, created_at, iniciado_em, finalizado_em, entregue_em,
        checklist_inicial_status, checklist_inicial_em, checklist_inicial_funcionario_id,
        observacoes, cliente_id, veiculo_id, servico_id, funcionario_id,
        clientes:cliente_id(nome, telefone),
        veiculos:veiculo_id(placa, modelo, cor),
        servicos:servico_id(nome),
        funcionarios:funcionario_id(nome)
      `)
      .eq("owner_id", ownerId)
      .in("status", ["aguardando", "em_lavagem", "finalizacao", "pronto", "entregue"])
      .order("posicao", { ascending: true });
    if (error) throw error;
    return { ordens: data ?? [] };
  });

export const updateOrdemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["aguardando", "em_lavagem", "finalizacao", "pronto", "entregue"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const patch: any = { status: data.status };
    if (data.status === "em_lavagem") {
      await assertPodeIniciarLavagem(supabase, ownerId, data.id);
      patch.iniciado_em = new Date().toISOString();
    }
    if (data.status === "pronto") patch.finalizado_em = new Date().toISOString();
    if (data.status === "entregue") patch.entregue_em = new Date().toISOString();
    const { error } = await supabase.from("ordens_servico").update(patch).eq("id", data.id).eq("owner_id", ownerId);
    if (error) throw error;
    return { ok: true };
  });

export const logWhatsappEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    cliente_id: z.string().uuid(),
    descricao: z.string().min(1).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { error } = await supabase.from("interacoes_clientes").insert({
      owner_id: ownerId,
      cliente_id: data.cliente_id,
      tipo: "whatsapp",
      descricao: data.descricao,
    });
    if (error) throw error;
    return { ok: true };
  });

export const getWhatsappLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { data, error } = await supabase
      .from("interacoes_clientes")
      .select("id, descricao, created_at, cliente_id, clientes:cliente_id(nome)")
      .eq("owner_id", ownerId)
      .eq("tipo", "whatsapp")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return { logs: data ?? [] };
  });

// ============ ORDENS ============
const ordemSchema = z.object({
  cliente_id: z.string().uuid(),
  veiculo_id: z.string().uuid().optional().nullable(),
  servico_id: z.string().uuid().optional().nullable(),
  funcionario_id: z.string().uuid().optional().nullable(),
  valor: z.number().min(0),
  observacoes: z.string().max(500).optional().nullable(),
});

export const createOrdem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ordemSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { error, data: row } = await supabase.from("ordens_servico").insert({ ...data, owner_id: ownerId, status: "aguardando" }).select().single();
    if (error) throw error;
    return { ordem: row };
  });

export const listOrdens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`id, status, valor, created_at, checklist_inicial_status, checklist_inicial_em,
               clientes:cliente_id(nome), veiculos:veiculo_id(placa), servicos:servico_id(nome),
               funcionarios:funcionario_id(nome), checklist_funcionario:checklist_inicial_funcionario_id(nome)`)
      .eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    const ids = (data ?? []).map((o: any) => o.id);
    const { data: upsells } = ids.length
      ? await supabase
          .from("os_upsell_oportunidades")
          .select("id, ordem_id, servico_sugerido, motivo, valor_estimado, status, origem_item_label")
          .eq("owner_id", ownerId)
          .in("ordem_id", ids)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };
    const { data: origens } = ids.length
      ? await supabase
          .from("receita_influenciada")
          .select("id, ordem_id, origem, valor, descricao, created_at")
          .eq("owner_id", ownerId)
          .in("ordem_id", ids)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };
    const byOrdem = new Map<string, any[]>();
    const origensByOrdem = new Map<string, any[]>();
    (upsells ?? []).forEach((u: any) => byOrdem.set(u.ordem_id, [...(byOrdem.get(u.ordem_id) ?? []), u]));
    (origens ?? []).forEach((r: any) => origensByOrdem.set(r.ordem_id, [...(origensByOrdem.get(r.ordem_id) ?? []), r]));
    return { ordens: (data ?? []).map((o: any) => ({ ...o, upsell_oportunidades: byOrdem.get(o.id) ?? [], origens_receita: origensByOrdem.get(o.id) ?? [] })) };
  });

// ============ CLIENTES ============
export const listClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [{ data: clientes }, { data: ordens }] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, pontos_saldo, created_at").eq("owner_id", ownerId).order("nome"),
      supabase.from("ordens_servico").select("cliente_id, created_at, valor").eq("owner_id", ownerId).gte("created_at", ninetyAgo),
    ]);
    const lastVisit = new Map<string, string>();
    const totalGasto = new Map<string, number>();
    const visitas = new Map<string, number>();
    (ordens ?? []).forEach((o) => {
      if (!lastVisit.has(o.cliente_id) || lastVisit.get(o.cliente_id)! < o.created_at) lastVisit.set(o.cliente_id, o.created_at);
      totalGasto.set(o.cliente_id, (totalGasto.get(o.cliente_id) ?? 0) + Number(o.valor ?? 0));
      visitas.set(o.cliente_id, (visitas.get(o.cliente_id) ?? 0) + 1);
    });
    return {
      clientes: (clientes ?? []).map((c) => ({
        ...c,
        ultima_visita: lastVisit.get(c.id) ?? null,
        total_gasto: totalGasto.get(c.id) ?? 0,
        visitas: visitas.get(c.id) ?? 0,
      })),
    };
  });

export const getClienteInativos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dias: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { data: clientes } = await supabase.from("clientes").select("id, nome, telefone, pontos_saldo").eq("owner_id", ownerId);
    const { data: ordens } = await supabase.from("ordens_servico").select("cliente_id, created_at").eq("owner_id", ownerId);
    const last = new Map<string, string>();
    (ordens ?? []).forEach((o) => { if (!last.has(o.cliente_id) || last.get(o.cliente_id)! < o.created_at) last.set(o.cliente_id, o.created_at); });
    const limit = Date.now() - data.dias * 86_400_000;
    const inativos = (clientes ?? []).map((c) => {
      const lv = last.get(c.id);
      const dias = lv ? Math.floor((Date.now() - new Date(lv).getTime()) / 86_400_000) : 999;
      return { ...c, ultima_visita: lv, dias_inativo: dias };
    }).filter((c) => !c.ultima_visita || new Date(c.ultima_visita).getTime() < limit);
    return { inativos };
  });

function campanhaMensagem(tipo: string, nome?: string) {
  const primeiroNome = nome ? nome.split(" ")[0] : "{{nome}}";
  const mensagens: Record<string, string> = {
    inativos: `Ola ${primeiroNome}! Sentimos sua falta por aqui. Quer agendar um horario esta semana para cuidar do seu veiculo?`,
    fidelidade: `Ola ${primeiroNome}! Voce possui beneficio disponivel no nosso programa de fidelidade. Quer aproveitar na sua proxima lavagem?`,
    assinatura: `Ola ${primeiroNome}! Temos planos para deixar suas lavagens mais praticas e previsiveis. Posso te explicar como funciona?`,
    baixa_ocupacao: `Ola ${primeiroNome}! Temos horarios disponiveis esta semana para cuidar do seu veiculo. Quer reservar um horario?`,
    aniversario: `Ola ${primeiroNome}! Feliz aniversario! Temos um convite especial para voce cuidar do seu veiculo com a gente.`,
  };
  return mensagens[tipo] ?? mensagens.inativos;
}

async function getCampanhaSugestoesData(supabase: any, ownerId: string) {
  const now = new Date();
  const hoje = now.toISOString().slice(0, 10);
  const futuro = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const fortyFiveAgo = new Date(Date.now() - 45 * 86_400_000).toISOString();

  const [{ data: clientes }, { data: ordens }, { data: recompensas }, { data: assinaturas }, { data: agendamentos }, { data: planos }] = await Promise.all([
    supabase.from("clientes").select("id, nome, telefone, pontos_saldo, created_at").eq("owner_id", ownerId),
    supabase.from("ordens_servico").select("id, cliente_id, valor, created_at").eq("owner_id", ownerId).gte("created_at", ninetyAgo),
    supabase.from("recompensas").select("custo_pontos, ativo").eq("owner_id", ownerId).eq("ativo", true).order("custo_pontos").limit(1),
    supabase.from("assinaturas_clientes").select("cliente_id, status").eq("owner_id", ownerId),
    supabase.from("agendamentos").select("id, data_agendada, status").eq("owner_id", ownerId).gte("data_agendada", hoje).lte("data_agendada", futuro),
    supabase.from("planos_assinatura").select("id, nome, valor_mensal, ativo").eq("owner_id", ownerId).eq("ativo", true).order("valor_mensal").limit(1),
  ]);

  const clientesRows = clientes ?? [];
  const ordensRows = ordens ?? [];
  const ticketMedio = ordensRows.length ? ordensRows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0) / ordensRows.length : 50;
  const lastVisit = new Map<string, string>();
  const visitas = new Map<string, number>();
  ordensRows.forEach((row: any) => {
    if (!lastVisit.has(row.cliente_id) || lastVisit.get(row.cliente_id)! < row.created_at) lastVisit.set(row.cliente_id, row.created_at);
    visitas.set(row.cliente_id, (visitas.get(row.cliente_id) ?? 0) + 1);
  });

  const inativos = clientesRows
    .map((c: any) => {
      const ultima = lastVisit.get(c.id);
      const dias = ultima ? Math.floor((Date.now() - new Date(ultima).getTime()) / 86_400_000) : 999;
      return { ...c, dias_inativo: dias };
    })
    .filter((c: any) => c.telefone && (!lastVisit.get(c.id) || lastVisit.get(c.id)! < fortyFiveAgo))
    .sort((a: any, b: any) => b.dias_inativo - a.dias_inativo)
    .slice(0, 30);

  const menorRecompensa = Number(recompensas?.[0]?.custo_pontos ?? 0);
  const fidelidade = menorRecompensa
    ? clientesRows.filter((c: any) => c.telefone && Number(c.pontos_saldo ?? 0) >= menorRecompensa).slice(0, 30)
    : [];

  const assinantes = new Set((assinaturas ?? []).filter((a: any) => a.status === "ativa").map((a: any) => a.cliente_id));
  const assinatura = clientesRows
    .filter((c: any) => c.telefone && (visitas.get(c.id) ?? 0) >= 4 && !assinantes.has(c.id))
    .slice(0, 30);

  const ocupacaoPorDia = new Map<string, number>();
  (agendamentos ?? []).forEach((a: any) => {
    if (["cancelado", "nao_compareceu"].includes(a.status)) return;
    ocupacaoPorDia.set(a.data_agendada, (ocupacaoPorDia.get(a.data_agendada) ?? 0) + 1);
  });
  const diasBaixos = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(Date.now() + idx * 86_400_000).toISOString().slice(0, 10);
    return { data: d, qtd: ocupacaoPorDia.get(d) ?? 0 };
  }).filter((d) => d.qtd <= 2);

  const sugestoes = [
    {
      tipo: "inativos",
      titulo: "Recuperar clientes inativos",
      descricao: `${inativos.length} cliente(s) sem retorno ha mais de 45 dias.`,
      impactoEstimado: roundMoney(inativos.length * ticketMedio),
      alvos: inativos.map((c: any) => ({ cliente_id: c.id, nome: c.nome, telefone: c.telefone, metadata: { dias_inativo: c.dias_inativo } })),
      mensagem: campanhaMensagem("inativos"),
    },
    {
      tipo: "fidelidade",
      titulo: "Ativar beneficios de fidelidade",
      descricao: `${fidelidade.length} cliente(s) possuem pontos para resgate.`,
      impactoEstimado: roundMoney(fidelidade.length * ticketMedio),
      alvos: fidelidade.map((c: any) => ({ cliente_id: c.id, nome: c.nome, telefone: c.telefone, metadata: { pontos: c.pontos_saldo } })),
      mensagem: campanhaMensagem("fidelidade"),
    },
    {
      tipo: "assinatura",
      titulo: "Oferecer plano para clientes frequentes",
      descricao: `${assinatura.length} cliente(s) frequentes ainda nao assinam um plano.`,
      impactoEstimado: roundMoney(assinatura.length * Number(planos?.[0]?.valor_mensal ?? ticketMedio)),
      alvos: assinatura.map((c: any) => ({ cliente_id: c.id, nome: c.nome, telefone: c.telefone, metadata: { visitas: visitas.get(c.id) ?? 0 } })),
      mensagem: campanhaMensagem("assinatura"),
    },
    {
      tipo: "baixa_ocupacao",
      titulo: "Preencher dias com baixa ocupacao",
      descricao: `${diasBaixos.length} dia(s) da semana estao com baixa demanda.`,
      impactoEstimado: roundMoney(Math.max(0, diasBaixos.length) * ticketMedio),
      alvos: inativos.slice(0, 15).map((c: any) => ({ cliente_id: c.id, nome: c.nome, telefone: c.telefone, metadata: { dias_baixos: diasBaixos } })),
      mensagem: campanhaMensagem("baixa_ocupacao"),
    },
  ].filter((s) => s.alvos.length > 0);

  return { sugestoes, ticketMedio };
}

export const getCampanhas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const [{ data: campanhas }, sugestoesData] = await Promise.all([
      context.supabase.from("campanhas").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(100),
      getCampanhaSugestoesData(context.supabase, ownerId),
    ]);
    const ids = (campanhas ?? []).map((c: any) => c.id);
    const { data: alvos } = ids.length
      ? await context.supabase.from("campanha_alvos").select("*").eq("owner_id", ownerId).in("campanha_id", ids)
      : { data: [] as any[] };
    const { data: receitas } = ids.length
      ? await context.supabase.from("receita_influenciada").select("valor, metadata").eq("owner_id", ownerId).eq("origem", "CAMPANHA").eq("referencia_tipo", "campanha_alvo").limit(1000)
      : { data: [] as any[] };
    const byCampanha = new Map<string, any[]>();
    const receitaByCampanha = new Map<string, number>();
    (alvos ?? []).forEach((a: any) => byCampanha.set(a.campanha_id, [...(byCampanha.get(a.campanha_id) ?? []), a]));
    (receitas ?? []).forEach((r: any) => {
      const campanhaId = r.metadata?.campanha_id;
      if (!campanhaId || !ids.includes(campanhaId)) return;
      receitaByCampanha.set(campanhaId, (receitaByCampanha.get(campanhaId) ?? 0) + Number(r.valor ?? 0));
    });
    return {
      campanhas: (campanhas ?? []).map((c: any) => ({ ...c, alvos: byCampanha.get(c.id) ?? [], receitaInfluenciada: receitaByCampanha.get(c.id) ?? 0 })),
      sugestoes: sugestoesData.sugestoes,
    };
  });

export const criarCampanhaInteligente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    tipo: z.enum(["inativos", "aniversario", "baixa_ocupacao", "fidelidade", "assinatura"]),
    nome: z.string().min(1).max(120),
    mensagem: z.string().min(1).max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const sugestoes = await getCampanhaSugestoesData(context.supabase, ownerId);
    const sugestao = sugestoes.sugestoes.find((s: any) => s.tipo === data.tipo);
    if (!sugestao || sugestao.alvos.length === 0) throw new Error("Nao ha alvos disponiveis para esta campanha.");
    const { data: campanha, error } = await context.supabase.from("campanhas").insert({
      owner_id: ownerId,
      nome: data.nome,
      tipo: data.tipo,
      canal: "whatsapp",
      status: "ativa",
      mensagem: data.mensagem,
      metadata: { impacto_estimado: sugestao.impactoEstimado },
    } as any).select("*").single();
    if (error) throw error;
    const rows = sugestao.alvos.map((a: any) => ({
      owner_id: ownerId,
      campanha_id: campanha.id,
      cliente_id: a.cliente_id,
      nome: a.nome,
      telefone: a.telefone,
      metadata: a.metadata ?? {},
    }));
    const { error: e2 } = await context.supabase.from("campanha_alvos").insert(rows as any);
    if (e2) throw e2;
    return { campanha };
  });

export const marcarCampanhaAlvoEnviado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const { error } = await context.supabase.from("campanha_alvos").update({ status: "enviado", sent_at: new Date().toISOString() } as any).eq("id", data.id).eq("owner_id", ownerId);
    if (error) throw error;
    return { ok: true };
  });

export const processarConversoesCampanhas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const { data: alvos } = await context.supabase
      .from("campanha_alvos")
      .select("id, campanha_id, cliente_id, sent_at, status, campanhas:campanha_id(nome, tipo)")
      .eq("owner_id", ownerId)
      .eq("status", "enviado")
      .not("cliente_id", "is", null)
      .not("sent_at", "is", null)
      .limit(200);

    let convertidos = 0;
    let receita = 0;
    for (const alvo of alvos ?? []) {
      const { data: ordem } = await context.supabase
        .from("ordens_servico")
        .select("id, cliente_id, valor, created_at")
        .eq("owner_id", ownerId)
        .eq("cliente_id", alvo.cliente_id)
        .gte("created_at", alvo.sent_at)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!ordem) continue;

      const { data: existente } = await context.supabase
        .from("receita_influenciada")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("origem", "CAMPANHA")
        .eq("referencia_tipo", "campanha_alvo")
        .eq("referencia_id", alvo.id)
        .maybeSingle();
      if (!existente) {
        await context.supabase.from("receita_influenciada").insert({
          owner_id: ownerId,
          ordem_id: ordem.id,
          cliente_id: ordem.cliente_id,
          origem: "CAMPANHA",
          valor: Number(ordem.valor ?? 0),
          descricao: `Conversao de campanha: ${(alvo.campanhas as any)?.nome ?? "Campanha"}`,
          referencia_tipo: "campanha_alvo",
          referencia_id: alvo.id,
          metadata: {
            campanha_id: alvo.campanha_id,
            campanha_nome: (alvo.campanhas as any)?.nome ?? null,
            campanha_tipo: (alvo.campanhas as any)?.tipo ?? null,
          },
        } as any);
      }
      await context.supabase
        .from("campanha_alvos")
        .update({ status: "convertido", converted_at: ordem.created_at } as any)
        .eq("id", alvo.id)
        .eq("owner_id", ownerId);
      convertidos += 1;
      receita += Number(ordem.valor ?? 0);
    }

    return { convertidos, receita };
  });

export const createCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    nome: z.string().min(1).max(120),
    telefone: z.string().max(20).optional().nullable(),
    origem_cliente: z.string().max(50).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { data: row, error } = await supabase.from("clientes").insert({ ...data, owner_id: ownerId }).select().single();
    if (error) throw error;
    return { cliente: row };
  });

export const getClienteDetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const [{ data: cliente }, { data: veiculos }, { data: ordens }, { data: interacoes }] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", data.id).eq("owner_id", ownerId).single(),
      supabase.from("veiculos").select("*").eq("cliente_id", data.id).eq("owner_id", ownerId),
      supabase.from("ordens_servico").select("id, valor, status, created_at, servicos:servico_id(nome)").eq("cliente_id", data.id).eq("owner_id", ownerId).order("created_at", { ascending: false }),
      supabase.from("interacoes_clientes").select("*").eq("cliente_id", data.id).eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(30),
    ]);
    const totalGasto = (ordens ?? []).reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const visitas = (ordens ?? []).length;
    const last = ordens?.[0]?.created_at ?? null;
    const dias = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) : 999;
    const score = Math.max(0, Math.min(100, 100 - dias + Math.min(40, visitas * 4)));
    return { cliente, veiculos: veiculos ?? [], ordens: ordens ?? [], interacoes: interacoes ?? [], totalGasto, visitas, score };
  });

// ============ VEÍCULOS ============
export const addVeiculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    cliente_id: z.string().uuid(),
    placa: z.string().min(1).max(10),
    marca: z.string().max(60).optional().nullable(),
    modelo: z.string().max(60).optional().nullable(),
    cor: z.string().max(30).optional().nullable(),
    vehicle_year: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { error } = await supabase.from("veiculos").insert({ ...data, owner_id: ownerId });
    if (error) throw error;
    return { ok: true };
  });

// ============ SERVIÇOS ============
export const listServicos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const { data } = await context.supabase.from("servicos").select("*").eq("owner_id", ownerId).order("nome");
    return { servicos: data ?? [] };
  });

export const upsertServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1).max(80),
    preco_padrao: z.number().min(0),
    categoria: z.string().max(80).optional().nullable(),
    descricao: z.string().max(1000).optional().nullable(),
    tempo_estimado_min: z.number().int().min(1).max(1440).default(30),
    pontos_gerados: z.number().int().min(0).max(100000).default(0),
    comissao_tipo: z.enum(["fixo", "percentual"]).optional().nullable(),
    comissao_valor: z.number().min(0).max(100000).default(0),
    disponivel_online: z.boolean().default(true),
    foto_url: z.string().max(500).optional().nullable(),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const row = { ...data, owner_id: ownerId };
    const { error } = data.id
      ? await context.supabase.from("servicos").update(row).eq("id", data.id).eq("owner_id", ownerId)
      : await context.supabase.from("servicos").insert(row);
    if (error) throw error;
    return { ok: true };
  });

// ============ EQUIPE ============
export const listFuncionarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const ninetyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [{ data: func }, { data: ordens }] = await Promise.all([
      context.supabase.from("funcionarios").select(FUNCIONARIO_SAFE_SELECT).eq("owner_id", ownerId).order("nome"),
      context.supabase.from("ordens_servico").select("funcionario_id, valor").eq("owner_id", ownerId).gte("created_at", ninetyAgo).eq("status", "entregue"),
    ]);
    const stats = new Map<string, { count: number; total: number }>();
    (ordens ?? []).forEach((o) => {
      if (!o.funcionario_id) return;
      const cur = stats.get(o.funcionario_id) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(o.valor ?? 0);
      stats.set(o.funcionario_id, cur);
    });
    const funcionarios = (func ?? []) as unknown as Array<Record<string, any> & { id: string }>;
    return {
      funcionarios: funcionarios.map((f) => ({ ...f, lavagens_mes: stats.get(f.id)?.count ?? 0, receita_mes: stats.get(f.id)?.total ?? 0 })),
    };
  });

export const upsertFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1).max(80),
    cargo: z.string().max(40).optional().nullable(),
    telefone: z.string().max(20).optional().nullable(),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const row = { ...data, owner_id: ownerId };
    const { error } = data.id
      ? await context.supabase.from("funcionarios").update(row).eq("id", data.id).eq("owner_id", ownerId)
      : await context.supabase.from("funcionarios").insert(row);
    if (error) throw error;
    return { ok: true };
  });

// ============ ASSINATURAS ============
export const getAssinaturas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
    assertTenantRole(role, GESTAO_ROLES);
    const [{ data: planos }, { data: todas }, { data: emp }] = await Promise.all([
      context.supabase.from("planos_assinatura").select("*").eq("owner_id", ownerId).order("valor_mensal"),
      context.supabase.from("assinaturas_clientes").select("*, clientes:cliente_id(nome, telefone), planos_assinatura:plano_id(nome, valor_mensal)").eq("owner_id", ownerId).order("created_at", { ascending: false }),
      context.supabase.from("empresa").select("slug").eq("owner_id", ownerId).maybeSingle(),
    ]);
    const ativas = (todas ?? []).filter((a: any) => a.status === "ativa");
    const pendentes = (todas ?? []).filter((a: any) => a.status === "pendente");
    const mrr = ativas.reduce((s, a: any) => s + Number(a.planos_assinatura?.valor_mensal ?? 0), 0);
    const hoje = new Date(); const limite = new Date(); limite.setDate(limite.getDate() + 7);
    const proximasCobrancas = ativas
      .filter((a: any) => { const d = new Date(a.proxima_cobranca); return d >= hoje && d <= limite; })
      .sort((a: any, b: any) => a.proxima_cobranca.localeCompare(b.proxima_cobranca));
    return {
      planos: planos ?? [],
      assinaturas: ativas,
      pendentes,
      proximasCobrancas,
      mrr,
      ativas: ativas.length,
      pendentesCount: pendentes.length,
      empresaSlug: emp?.slug ?? null,
    };
  });

function slugifyPlano(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export const upsertPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1).max(80),
    valor_mensal: z.number().min(0),
    quantidade_lavagens: z.number().int().min(1).max(99),
    beneficios: z.array(z.string()).default([]),
    descricao: z.string().max(500).optional().nullable(),
    chave_pix: z.string().max(140).optional().nullable(),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
    assertTenantRole(role, GESTAO_ROLES);
    const row: any = { ...data, owner_id: ownerId };
    if (!data.id) {
      const base = slugifyPlano(data.nome) || "plano";
      row.slug = `${base}-${ownerId.slice(0, 6)}`;
    }
    const { error } = data.id
      ? await context.supabase.from("planos_assinatura").update(row).eq("id", data.id).eq("owner_id", ownerId)
      : await context.supabase.from("planos_assinatura").insert(row);
    if (error) throw error;
    return { ok: true };
  });

// ============ ASSINATURAS — PÚBLICAS ============
export const getPlanoPublico = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plano, error } = await supabaseAdmin
      .from("planos_assinatura")
      .select("id, owner_id, nome, valor_mensal, quantidade_lavagens, beneficios, descricao, chave_pix, ativo, slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    if (!plano || !plano.ativo) throw new Error("Plano não encontrado");
    const { data: empresa } = await supabaseAdmin
      .from("empresa")
      .select("nome_fantasia, whatsapp, telefone, endereco, logo_url, slug")
      .eq("owner_id", plano.owner_id)
      .maybeSingle();
    return { plano, empresa };
  });

export const criarAssinaturaPendente = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    slug: z.string().min(1).max(120),
    nome: z.string().min(2).max(120),
    telefone: z.string().min(8).max(20),
    veiculo: z.string().max(80).optional(),
    placa: z.string().max(10).optional(),
    observacoes: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plano } = await supabaseAdmin.from("planos_assinatura").select("id, owner_id, ativo").eq("slug", data.slug).maybeSingle();
    if (!plano || !plano.ativo) throw new Error("Plano não encontrado");
    const owner_id = plano.owner_id;

    const { data: existing } = await supabaseAdmin.from("clientes")
      .select("id").eq("owner_id", owner_id).eq("telefone", data.telefone).maybeSingle();
    let cliente_id = existing?.id;
    if (!cliente_id) {
      const { data: novo, error } = await supabaseAdmin.from("clientes").insert({
        owner_id, nome: data.nome, telefone: data.telefone, origem_cliente: "Assinatura online",
      }).select("id").single();
      if (error) throw error;
      cliente_id = novo.id;
    }

    let veiculo_id: string | null = null;
    if (data.placa) {
      const placa = data.placa.toUpperCase();
      const { data: vexist } = await supabaseAdmin.from("veiculos")
        .select("id").eq("owner_id", owner_id).eq("cliente_id", cliente_id).eq("placa", placa).maybeSingle();
      if (vexist) veiculo_id = vexist.id;
      else {
        const { data: vnovo } = await supabaseAdmin.from("veiculos").insert({
          owner_id, cliente_id, placa, modelo: data.veiculo ?? null,
        }).select("id").single();
        veiculo_id = vnovo?.id ?? null;
      }
    }

    const obs = [data.veiculo && !data.placa ? `Veículo: ${data.veiculo}` : null, data.observacoes].filter(Boolean).join(" · ");
    const { data: ass, error: e2 } = await supabaseAdmin.from("assinaturas_clientes").insert({
      owner_id, cliente_id, plano_id: plano.id,
      status: "pendente" as any, veiculo_id,
      observacoes: obs || null, metodo_pagamento: "pix",
    }).select("id").single();
    if (e2) throw e2;
    return { ok: true, id: ass.id };
  });

export const confirmarPagamentoAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), gateway_ref: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
    assertTenantRole(role, GESTAO_ROLES);
    const proxima = new Date(); proxima.setDate(proxima.getDate() + 30);
    const { error } = await context.supabase.from("assinaturas_clientes").update({
      status: "ativa" as any,
      pago_em: new Date().toISOString(),
      proxima_cobranca: proxima.toISOString().slice(0, 10),
      lavagens_usadas_mes: 0,
      gateway_ref: data.gateway_ref ?? null,
    }).eq("id", data.id).eq("owner_id", ownerId);
    if (error) throw error;
    return { ok: true };
  });

export const cancelarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
    assertTenantRole(role, GESTAO_ROLES);
    const { error } = await context.supabase.from("assinaturas_clientes")
      .update({ status: "cancelada" as any })
      .eq("id", data.id).eq("owner_id", ownerId);
    if (error) throw error;
    return { ok: true };
  });

// ============ FIDELIDADE ============
export const getFidelidade = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const [{ data: cfg }, { data: recompensas }, { data: top }] = await Promise.all([
      context.supabase.from("fidelidade_config").select("*").eq("owner_id", ownerId).maybeSingle(),
      context.supabase.from("recompensas").select("*").eq("owner_id", ownerId).order("custo_pontos"),
      context.supabase.from("clientes").select("id, nome, pontos_saldo").eq("owner_id", ownerId).order("pontos_saldo", { ascending: false }).limit(10),
    ]);
    return { config: cfg, recompensas: recompensas ?? [], top: top ?? [] };
  });

export const updateFidelidadeConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pontos_por_lavagem: z.number().int().min(0).max(1000),
    pontos_por_real: z.number().min(0).max(100),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const { error } = await context.supabase.from("fidelidade_config").upsert({ ...data, owner_id: ownerId }, { onConflict: "owner_id" });
    if (error) throw error;
    return { ok: true };
  });

export const upsertRecompensa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1).max(80),
    custo_pontos: z.number().int().min(1),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const row = { ...data, owner_id: ownerId };
    const { error } = data.id
      ? await context.supabase.from("recompensas").update(row).eq("id", data.id).eq("owner_id", ownerId)
      : await context.supabase.from("recompensas").insert(row);
    if (error) throw error;
    return { ok: true };
  });

// ============ EMPRESA / CONFIGURAÇÕES ============
export const getEmpresa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const { data } = await context.supabase.from("empresa").select("*").eq("owner_id", ownerId).maybeSingle();
    return { empresa: data, ownerId };
  });

export const updateEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    nome_fantasia: z.string().min(1).max(120),
    razao_social: z.string().max(120).optional().nullable(),
    telefone: z.string().max(20).optional().nullable(),
    whatsapp: z.string().max(20).optional().nullable(),
    email: z.string().max(120).optional().nullable(),
    endereco: z.string().max(200).optional().nullable(),
    instagram: z.string().max(80).optional().nullable(),
    horario_funcionamento: z.string().max(120).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const { error } = await context.supabase.from("empresa").upsert({ ...data, owner_id: ownerId }, { onConflict: "owner_id" });
    if (error) throw error;
    return { ok: true };
  });

// ============ RELATÓRIOS ============
export const getRelatorios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data: ordens } = await context.supabase
      .from("ordens_servico")
      .select("valor, created_at, status, servicos:servico_id(nome), funcionarios:funcionario_id(nome)")
      .eq("owner_id", ownerId).gte("created_at", ninetyAgo);

    const porServico = new Map<string, number>();
    const porFunc = new Map<string, number>();
    let total = 0; let entregues = 0;
    (ordens ?? []).forEach((o: any) => {
      total += Number(o.valor ?? 0);
      if (o.status === "entregue") entregues++;
      const s = o.servicos?.nome ?? "—";
      const f = o.funcionarios?.nome ?? "—";
      porServico.set(s, (porServico.get(s) ?? 0) + Number(o.valor ?? 0));
      porFunc.set(f, (porFunc.get(f) ?? 0) + Number(o.valor ?? 0));
    });
    return {
      total, entregues, qtd: (ordens ?? []).length,
      porServico: Array.from(porServico, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor),
      porFuncionario: Array.from(porFunc, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor),
    };
  });

const RECEITA_ORIGENS: Record<string, string> = {
  CLIENTE_RECUPERADO: "Clientes recuperados",
  FIDELIDADE: "Programa de Fidelidade",
  UPSELL_CHECKLIST: "Checklist",
  CONSULTOR_IA: "Consultor IA",
  CAMPANHA: "Campanhas",
  ANIVERSARIO: "Aniversarios",
  LEVA_ETRAZ: "Leva e Traz",
  ASSINATURAS: "Assinaturas",
};

function periodoReceitaInfluenciada(periodo = "mes") {
  const now = new Date();
  const fim = new Date(now);
  if (periodo === "hoje") return { inicio: new Date(now.getFullYear(), now.getMonth(), now.getDate()), fim };
  if (periodo === "semana") return { inicio: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), fim };
  if (periodo === "ano") return { inicio: new Date(now.getFullYear(), 0, 1), fim };
  return { inicio: new Date(now.getFullYear(), now.getMonth(), 1), fim };
}

function clampScore(value: number) {
  return Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)));
}

async function getReceitaInfluenciadaData(supabase: any, ownerId: string, opts: { periodo?: string; inicio?: string; fim?: string } = {}) {
  const base = periodoReceitaInfluenciada(opts.periodo);
  const inicio = opts.inicio ? new Date(opts.inicio) : base.inicio;
  const fim = opts.fim ? new Date(opts.fim) : base.fim;
  const inicioIso = inicio.toISOString();
  const fimIso = fim.toISOString();
  const inicioDia = inicioIso.slice(0, 10);
  const fimDia = fimIso.slice(0, 10);

  const [{ data: ordens }, { data: eventos }, { data: levaTraz }, { data: clientes }, { data: assinaturas }, { data: agendamentos }, { data: upsells }, { data: funcionarios }, { data: vitrineEventos }] = await Promise.all([
    supabase.from("ordens_servico").select("id, valor, status, created_at, cliente_id, funcionario_id").eq("owner_id", ownerId).gte("created_at", inicioIso).lte("created_at", fimIso),
    supabase.from("receita_influenciada").select("*").eq("owner_id", ownerId).gte("created_at", inicioIso).lte("created_at", fimIso),
    supabase.from("agendamentos")
      .select("id, ordem_id, cliente_id, taxa_leva_traz, data_agendada, clientes:cliente_id(nome)")
      .eq("owner_id", ownerId)
      .eq("leva_traz", true)
      .gt("taxa_leva_traz", 0)
      .gte("data_agendada", inicioDia)
      .lte("data_agendada", fimDia),
    supabase.from("clientes").select("id, pontos_saldo").eq("owner_id", ownerId),
    supabase.from("assinaturas_clientes").select("id, cliente_id, status").eq("owner_id", ownerId),
    supabase.from("agendamentos").select("id, status, data_agendada").eq("owner_id", ownerId).gte("data_agendada", inicioDia).lte("data_agendada", fimDia),
    supabase.from("os_upsell_oportunidades").select("id, status, valor_estimado").eq("owner_id", ownerId).gte("created_at", inicioIso).lte("created_at", fimIso),
    supabase.from("funcionarios").select("id, ativo").eq("owner_id", ownerId).eq("ativo", true),
    supabase.from("public_page_events").select("id, evento, created_at").eq("owner_id", ownerId).gte("created_at", inicioIso).lte("created_at", fimIso),
  ]);

  const rows = [...(eventos ?? [])];
  const refs = new Set(rows.map((row: any) => `${row.origem}:${row.referencia_tipo}:${row.referencia_id}`));
  (levaTraz ?? []).forEach((row: any) => {
    const key = `LEVA_ETRAZ:agendamento:${row.id}`;
    if (refs.has(key)) return;
    rows.push({
      id: key,
      owner_id: ownerId,
      ordem_id: row.ordem_id,
      cliente_id: row.cliente_id,
      funcionario_id: null,
      origem: "LEVA_ETRAZ",
      valor: Number(row.taxa_leva_traz ?? 0),
      descricao: "Servico Leva e Traz contratado",
      referencia_tipo: "agendamento",
      referencia_id: row.id,
      metadata: { cliente: row.clientes?.nome ?? null },
      created_at: `${row.data_agendada}T12:00:00.000Z`,
    });
  });

  const totalReceita = (ordens ?? []).reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
  const categorias = Object.entries(RECEITA_ORIGENS).map(([origem, label]) => {
    const catRows = rows.filter((row: any) => row.origem === origem);
    return {
      origem,
      label,
      valor: catRows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0),
      quantidade: catRows.length,
    };
  });
  const totalInfluenciada = categorias.reduce((sum, row) => sum + row.valor, 0);
  const ticketMedio = (ordens ?? []).length ? totalReceita / (ordens ?? []).length : 0;
  const ordensPorCliente = new Map<string, number>();
  (ordens ?? []).forEach((row: any) => {
    if (!row.cliente_id) return;
    ordensPorCliente.set(row.cliente_id, (ordensPorCliente.get(row.cliente_id) ?? 0) + 1);
  });
  const clientesRows = clientes ?? [];
  const retorno = clientesRows.length ? Array.from(ordensPorCliente.values()).filter((qtd) => qtd >= 2).length / clientesRows.length : 0;
  const assinantesAtivos = new Set((assinaturas ?? []).filter((row: any) => row.status === "ativa").map((row: any) => row.cliente_id));
  const clientesComPontos = clientesRows.filter((row: any) => Number(row.pontos_saldo ?? 0) > 0).length;
  const fidelizacao = clientesRows.length ? Math.min(1, (assinantesAtivos.size + clientesComPontos) / clientesRows.length) : 0;
  const upsellRows = upsells ?? [];
  const conversaoUpsell = upsellRows.length ? upsellRows.filter((row: any) => row.status === "aceita").length / upsellRows.length : 0;
  const funcionariosAtivos = Math.max(1, (funcionarios ?? []).length);
  const ordensConcluidas = (ordens ?? []).filter((row: any) => ["pronto", "entregue"].includes(row.status)).length;
  const produtividade = Math.min(1, (ordensConcluidas / funcionariosAtivos) / 25);
  const agendaRows = agendamentos ?? [];
  const compareceu = agendaRows.filter((row: any) => ["confirmado", "concluido"].includes(row.status)).length;
  const naoCompareceu = agendaRows.filter((row: any) => ["cancelado", "nao_compareceu"].includes(row.status)).length;
  const comparecimento = compareceu + naoCompareceu ? compareceu / (compareceu + naoCompareceu) : 0;
  const usoIa = rows.some((row: any) => row.origem === "CONSULTOR_IA") ? 1 : rows.length > 0 ? 0.4 : 0;
  const componentesIndice = [
    { chave: "ticket_medio", label: "Ticket medio", peso: 15, score: clampScore((ticketMedio / 80) * 100) },
    { chave: "retorno", label: "Retorno", peso: 15, score: clampScore(retorno * 100) },
    { chave: "fidelizacao", label: "Fidelizacao", peso: 10, score: clampScore(fidelizacao * 100) },
    { chave: "upsell", label: "Conversao de upsell", peso: 15, score: clampScore(conversaoUpsell * 100) },
    { chave: "receita_influenciada", label: "Receita influenciada", peso: 15, score: clampScore(((totalReceita ? totalInfluenciada / totalReceita : 0) / 0.2) * 100) },
    { chave: "produtividade", label: "Produtividade", peso: 15, score: clampScore(produtividade * 100) },
    { chave: "comparecimento", label: "Comparecimento", peso: 10, score: clampScore(comparecimento * 100) },
    { chave: "uso_ia", label: "Uso das recomendacoes da IA", peso: 5, score: clampScore(usoIa * 100) },
  ];
  const indiceScore = clampScore(componentesIndice.reduce((sum, item) => sum + (item.score * item.peso) / 100, 0));
  const vitrineRows = vitrineEventos ?? [];
  const visualizacoes = vitrineRows.filter((row: any) => row.evento === "visualizacao").length;
  const solicitacoes = vitrineRows.filter((row: any) => row.evento === "solicitacao_agendamento").length;
  const vitrinePorDia = new Map<string, { visualizacoes: number; solicitacoes: number }>();
  vitrineRows.forEach((row: any) => {
    const dia = String(row.created_at ?? "").slice(0, 10);
    if (!dia) return;
    const cur = vitrinePorDia.get(dia) ?? { visualizacoes: 0, solicitacoes: 0 };
    if (row.evento === "visualizacao") cur.visualizacoes += 1;
    if (row.evento === "solicitacao_agendamento") cur.solicitacoes += 1;
    vitrinePorDia.set(dia, cur);
  });
  const porDia = new Map<string, number>();
  rows.forEach((row: any) => {
    const dia = String(row.created_at ?? "").slice(0, 10);
    if (!dia) return;
    porDia.set(dia, (porDia.get(dia) ?? 0) + Number(row.valor ?? 0));
  });

  return {
    periodo: opts.periodo ?? "mes",
    inicio: inicioIso,
    fim: fimIso,
    totalReceita,
    totalInfluenciada,
    percentual: totalReceita ? totalInfluenciada / totalReceita : 0,
    indiceLavaFlow: {
      score: indiceScore,
      nivel: indiceScore >= 80 ? "Excelente" : indiceScore >= 60 ? "Saudavel" : indiceScore >= 40 ? "Atencao" : "Critico",
      componentes: componentesIndice,
      resumo: {
        ticketMedio,
        retorno,
        fidelizacao,
        conversaoUpsell,
        produtividade,
        comparecimento,
      },
    },
    vitrinePublica: {
      visualizacoes,
      solicitacoes,
      conversao: visualizacoes ? solicitacoes / visualizacoes : 0,
      timeline: Array.from(vitrinePorDia, ([dia, valores]) => ({ dia, ...valores })).sort((a, b) => a.dia.localeCompare(b.dia)),
    },
    categorias,
    timeline: Array.from(porDia, ([dia, valor]) => ({ dia, valor })).sort((a, b) => a.dia.localeCompare(b.dia)),
    ultimosEventos: rows
      .slice()
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8)
      .map((row: any) => ({ ...row, label: RECEITA_ORIGENS[row.origem] ?? row.origem })),
  };
}

export const getRelatoriosExecutivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [{ data: ordens }, { data: clientes }, { data: assinaturas }, { data: planos }, { data: agendamentos }] = await Promise.all([
      supabase.from("ordens_servico")
        .select("id, valor, status, created_at, cliente_id, servicos:servico_id(nome)")
        .eq("owner_id", ownerId)
        .gte("created_at", ninetyAgo),
      supabase.from("clientes").select("id, nome, created_at, pontos_saldo").eq("owner_id", ownerId),
      supabase.from("assinaturas_clientes")
        .select("id, cliente_id, status, planos_assinatura:plano_id(valor_mensal)")
        .eq("owner_id", ownerId),
      supabase.from("planos_assinatura").select("valor_mensal").eq("owner_id", ownerId).eq("ativo", true).order("valor_mensal", { ascending: true }).limit(1),
      supabase.from("agendamentos")
        .select("id, cliente_id, leva_traz, taxa_leva_traz, clientes:cliente_id(nome)")
        .eq("owner_id", ownerId)
        .gte("data_agendada", ninetyAgo.slice(0, 10)),
    ]);

    const ordensMes = (ordens ?? []).filter((o: any) => o.created_at >= startMonth);
    const faturamentoMensal = ordensMes.reduce((s: number, o: any) => s + Number(o.valor ?? 0), 0);
    const faturamento90 = (ordens ?? []).reduce((s: number, o: any) => s + Number(o.valor ?? 0), 0);
    const ticketMedio = ordens?.length ? faturamento90 / ordens.length : 0;
    const receitaRecorrente = (assinaturas ?? [])
      .filter((a: any) => a.status === "ativa")
      .reduce((s: number, a: any) => s + Number(a.planos_assinatura?.valor_mensal ?? 0), 0);
    const novosClientes = (clientes ?? []).filter((c: any) => c.created_at >= startMonth).length;

    const clientesAtivos90 = new Set((ordens ?? []).map((o: any) => o.cliente_id));
    const clientesRecentes30 = new Set((ordens ?? []).filter((o: any) => o.created_at >= thirtyAgo).map((o: any) => o.cliente_id));
    const retencao = clientesAtivos90.size ? clientesRecentes30.size / clientesAtivos90.size : 0;

    const inativos = (clientes ?? []).filter((c: any) => !clientesRecentes30.has(c.id)).length;
    const receitaRecuperavel = inativos * (ticketMedio || 50);
    const assinaturasAtivas = new Set((assinaturas ?? []).filter((a: any) => a.status === "ativa").map((a: any) => a.cliente_id));
    const byCliente = new Map<string, number>();
    (ordens ?? []).forEach((o: any) => byCliente.set(o.cliente_id, (byCliente.get(o.cliente_id) ?? 0) + 1));
    const candidatosAssinatura = Array.from(byCliente.entries()).filter(([clienteId, visitas]) => visitas >= 4 && !assinaturasAtivas.has(clienteId)).length;
    const potencialAssinaturas = candidatosAssinatura * Number(planos?.[0]?.valor_mensal ?? 0);

    const porDia = new Map<string, number>();
    const porServico = new Map<string, { nome: string; valor: number; qtd: number }>();
    (ordens ?? []).forEach((o: any) => {
      const dia = o.created_at.slice(0, 10);
      porDia.set(dia, (porDia.get(dia) ?? 0) + Number(o.valor ?? 0));
      const nome = o.servicos?.nome ?? "Sem serviço";
      const cur = porServico.get(nome) ?? { nome, valor: 0, qtd: 0 };
      cur.valor += Number(o.valor ?? 0);
      cur.qtd += 1;
      porServico.set(nome, cur);
    });

    const levaTraz = (agendamentos ?? []).filter((a: any) => a.leva_traz);
    const levaTrazClientes = new Map<string, { nome: string; qtd: number; valor: number }>();
    levaTraz.forEach((a: any) => {
      const key = a.cliente_id ?? a.clientes?.nome ?? "sem-cliente";
      const cur = levaTrazClientes.get(key) ?? { nome: a.clientes?.nome ?? "Cliente", qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(a.taxa_leva_traz ?? 0);
      levaTrazClientes.set(key, cur);
    });

    const scoreSaude = Math.round(Math.max(0, Math.min(100,
      (retencao * 40)
      + (receitaRecorrente > 0 ? 15 : 0)
      + (ticketMedio >= 40 ? 15 : (ticketMedio / 40) * 15)
      + (faturamentoMensal > 0 ? 20 : 0)
      + (novosClientes > 0 ? 10 : 0),
    )));
    const receitaInfluenciada = await getReceitaInfluenciadaData(supabase, ownerId, { periodo: "mes" });

    return {
      cards: {
        faturamentoMensal,
        ticketMedio,
        receitaRecorrente,
        novosClientes,
        retencao,
        scoreSaude,
        receitaRecuperavel,
        potencialAssinaturas,
      },
      serieFaturamento: Array.from(porDia, ([dia, valor]) => ({ dia, valor })).sort((a, b) => a.dia.localeCompare(b.dia)),
      servicosMaisVendidos: Array.from(porServico.values()).sort((a, b) => b.valor - a.valor),
      evolucaoClientes: (clientes ?? []).map((c: any) => ({ dia: c.created_at.slice(0, 10), valor: 1 })),
      retencaoClientes: { ativos90: clientesAtivos90.size, recentes30: clientesRecentes30.size, retencao },
      levaTraz: {
        quantidade: levaTraz.length,
        receita: levaTraz.reduce((s: number, a: any) => s + Number(a.taxa_leva_traz ?? 0), 0),
        clientes: Array.from(levaTrazClientes.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 10),
      },
      receitaInfluenciada,
    };
  });

export const getReceitaInfluenciada = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { periodo?: string; inicio?: string; fim?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    return getReceitaInfluenciadaData(context.supabase, ownerId, data);
  });

// ============ ESCOPO DO TENANT ============
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
  const sorted = rows
    .slice()
    .sort((a, b) => {
      const byRole = (priority[a.role] ?? 99) - (priority[b.role] ?? 99);
      if (byRole) return byRole;
      const byCreated = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
      if (byCreated) return byCreated;
      return String(a.owner_id).localeCompare(String(b.owner_id));
    });
  const current = selfOwner ?? sorted[0];
  return {
    ownerId: current?.owner_id ?? userId,
    role: current?.role ?? "owner",
  };
}

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const scope = await getOwnerScope(context.supabase, context.userId);
    return scope;
  });

export const vincularColaborador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    funcionario_id: z.string().uuid(),
    email: z.string().email().max(160),
    role: z.enum(["admin", "gerente", "atendente", "lavador"]).default("lavador"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("vincular_colaborador", {
      _funcionario_id: data.funcionario_id,
      _email: data.email,
      _role: data.role,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ RBAC — perfil corrente, membros, troca de papel ============
export const getCurrentUserRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("current_user_role");
    if (error) throw new Error(error.message);
    return { role: (data as string | null) ?? null };
  });

export const listTenantMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("list_tenant_members");
    if (error) throw new Error(error.message);
    return { membros: (data as any[]) ?? [] };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    role: z.enum(["admin", "gerente", "atendente", "lavador"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_member_role", {
      _user_id: data.user_id,
      _role: data.role,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const upsertFuncionarioFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1).max(80),
    avatar_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
    cargo: z.string().max(40).optional().nullable(),
    telefone: z.string().max(20).optional().nullable(),
    email: z.string().email().max(160).optional().nullable().or(z.literal("")),
    comissao_tipo: z.enum(["fixo", "percentual"]).default("fixo"),
    comissao_valor: z.number().min(0).max(10000).default(0),
    comissao_modo: z.enum(["global", "por_servico"]).default("global"),
    especialidades: z.array(z.string().max(80)).default([]),
    horario_inicio: z.string().regex(/^\d{2}:\d{2}/).default("08:00"),
    horario_fim: z.string().regex(/^\d{2}:\d{2}/).default("18:00"),
    dias_disponiveis: z.array(z.number().int().min(0).max(6)).default([1,2,3,4,5,6]),
    capacidade_por_horario: z.number().int().min(1).max(20).default(1),
    tempo_medio_servicos: z.record(z.string(), z.number().int().min(1).max(1440)).default({}),
    ativo: z.boolean().default(true),
    pin: z.string().regex(/^\d{4}$|^\d{6}$/).optional().or(z.literal("")),
    pin_digits: z.union([z.literal(4), z.literal(6)]).default(4),
    perm_iniciar_atendimento: z.boolean().default(true),
    perm_finalizar_atendimento: z.boolean().default(true),
    perm_realizar_checklist: z.boolean().default(true),
    perm_ver_apenas_atribuidos: z.boolean().default(true),
    perm_ver_todos_veiculos: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
    assertTenantRole(role, ADMIN_ROLES, "Apenas owner ou admin podem gerenciar funcionarios.");
    const canManageComissoes = ADMIN_ROLES.includes(role);
    const row: any = { ...data, owner_id: ownerId };
    const pin = row.pin;
    delete row.pin;
    if (row.email === "") row.email = null;
    if (row.avatar_url === "") row.avatar_url = null;
    if (!canManageComissoes) {
      delete row.comissao_tipo;
      delete row.comissao_valor;
      delete row.comissao_modo;
    }
    if (pin) {
      row.pin_hash = await hashSecret(pin);
      row.pin_failed_attempts = 0;
      row.pin_locked_until = null;
    }
    const { error } = data.id
      ? await context.supabase.from("funcionarios").update(row).eq("id", data.id).eq("owner_id", ownerId)
      : await context.supabase.from("funcionarios").insert(row);
    if (error) throw error;
    return { ok: true };
  });

// ============ COMISSÕES POR SERVIÇO ============
// ============ MODO EQUIPE - ACESSO RAPIDO POR PIN ============
export const getEquipeAcessoPublico = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(2).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin.rpc("get_empresa_by_slug", { _slug: data.slug });
    const empresa = Array.isArray(emp) ? emp[0] : emp;
    if (!empresa?.owner_id) throw new Error("Empresa nao encontrada");

    const { data: funcionarios, error } = await supabaseAdmin
      .from("funcionarios")
      .select("id, nome, cargo, ativo, avatar_url, pin_digits, pin_hash, pin_locked_until")
      .eq("owner_id", empresa.owner_id)
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;

    const { data: emAtendimento } = await supabaseAdmin
      .from("ordens_servico")
      .select("funcionario_id")
      .eq("owner_id", empresa.owner_id)
      .eq("status", "em_lavagem");
    const ocupados = new Set((emAtendimento ?? []).map((o: any) => o.funcionario_id).filter(Boolean));

    return {
      empresa: { nome: empresa.nome_fantasia ?? "LavaFlow", slug: data.slug },
      colaboradores: (funcionarios ?? []).map((f: any) => ({
        id: f.id,
        nome: f.nome,
        cargo: f.cargo,
        avatar_url: f.avatar_url,
        pin_digits: f.pin_digits ?? 4,
        pin_configurado: !!f.pin_hash,
        bloqueado_ate: f.pin_locked_until,
        status: ocupados.has(f.id) ? "Em atendimento" : "Disponivel",
      })),
    };
  });

export const autenticarEquipePin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    slug: z.string().min(2).max(80),
    funcionario_id: z.string().uuid(),
    pin: z.string().regex(/^\d{4}$|^\d{6}$/),
    device_id: z.string().max(120).optional(),
    user_agent: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin.rpc("get_empresa_by_slug", { _slug: data.slug });
    const empresa = Array.isArray(emp) ? emp[0] : emp;
    if (!empresa?.owner_id) throw new Error("Empresa nao encontrada");

    const { data: funcionario, error } = await supabaseAdmin
      .from("funcionarios")
      .select("id, owner_id, nome, ativo, pin_hash, pin_failed_attempts, pin_locked_until")
      .eq("id", data.funcionario_id)
      .eq("owner_id", empresa.owner_id)
      .maybeSingle();
    if (error) throw error;
    if (!funcionario?.ativo) throw new Error("Colaborador inativo");
    if (!funcionario.pin_hash) throw new Error("PIN ainda nao configurado");
    if (funcionario.pin_locked_until && new Date(funcionario.pin_locked_until).getTime() > Date.now()) {
      throw new Error("PIN bloqueado temporariamente");
    }

    const ok = await verifySecret(data.pin, funcionario.pin_hash);
    await supabaseAdmin.from("equipe_pin_attempts").insert({
      owner_id: empresa.owner_id,
      funcionario_id: funcionario.id,
      success: ok,
      device_id: data.device_id ?? null,
      user_agent: data.user_agent ?? null,
    } as any);

    if (!ok) {
      const attempts = Number(funcionario.pin_failed_attempts ?? 0) + 1;
      const locked = attempts >= 5 ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
      await supabaseAdmin.from("funcionarios").update({
        pin_failed_attempts: attempts,
        pin_locked_until: locked,
      } as any).eq("id", funcionario.id);
      throw new Error(locked ? "PIN bloqueado por 5 minutos" : "PIN incorreto");
    }

    await supabaseAdmin.from("funcionarios").update({
      pin_failed_attempts: 0,
      pin_locked_until: null,
    } as any).eq("id", funcionario.id);

    const token = await newSessionToken();
    await supabaseAdmin.from("equipe_sessoes").insert({
      owner_id: empresa.owner_id,
      funcionario_id: funcionario.id,
      token_hash: await tokenHash(token),
      device_id: data.device_id ?? null,
      user_agent: data.user_agent ?? null,
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    } as any);
    await supabaseAdmin.from("equipe_auditoria").insert({
      owner_id: empresa.owner_id,
      funcionario_id: funcionario.id,
      acao: "login_pin",
      metadata: { device_id: data.device_id ?? null },
    } as any);
    return { token, funcionario: { id: funcionario.id, nome: funcionario.nome }, slug: data.slug };
  });

async function getEquipeSession(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sessao, error } = await supabaseAdmin
    .from("equipe_sessoes")
    .select("id, owner_id, funcionario_id, expires_at")
    .eq("token_hash", await tokenHash(token))
    .maybeSingle();
  if (error) throw error;
  if (!sessao || new Date(sessao.expires_at).getTime() <= Date.now()) throw new Error("Sessao expirada");
  await supabaseAdmin.from("equipe_sessoes").update({ last_seen_at: new Date().toISOString() } as any).eq("id", sessao.id);
  return { supabaseAdmin, sessao };
}

export const getModoEquipe = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(20) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sessao } = await getEquipeSession(data.token);
    const { data: funcionario, error: funcError } = await supabaseAdmin
      .from("funcionarios")
      .select("id, nome, cargo, avatar_url, ativo, perm_iniciar_atendimento, perm_finalizar_atendimento, perm_realizar_checklist, perm_ver_apenas_atribuidos, perm_ver_todos_veiculos")
      .eq("id", sessao.funcionario_id)
      .eq("owner_id", sessao.owner_id)
      .maybeSingle();
    if (funcError) throw funcError;
    if (!funcionario?.ativo) throw new Error("Colaborador inativo");

    const startToday = startOfTodayIso();
    const exigirChecklistInicial = await getExigeChecklistInicial(supabaseAdmin, sessao.owner_id);
    let query = supabaseAdmin
      .from("ordens_servico")
      .select(`id, status, valor, created_at, iniciado_em, finalizado_em, entregue_em, funcionario_id, observacoes,
               checklist_inicial_status, checklist_inicial_em, checklist_inicial_funcionario_id,
               clientes:cliente_id(nome, telefone), veiculos:veiculo_id(placa, modelo), servicos:servico_id(nome)`)
      .eq("owner_id", sessao.owner_id)
      .in("status", ["aguardando", "em_lavagem", "pronto"])
      .order("created_at", { ascending: true });
    if (funcionario.perm_ver_apenas_atribuidos && !funcionario.perm_ver_todos_veiculos) {
      query = query.or(`funcionario_id.eq.${funcionario.id},funcionario_id.is.null`);
    }
    const { data: ordens, error } = await query;
    if (error) throw error;
    const ordemIds = (ordens ?? []).map((o: any) => o.id);
    const { data: checklists } = ordemIds.length
      ? await supabaseAdmin
          .from("os_checklists")
          .select("id, ordem_id, status, itens, observacoes, created_at, funcionarios:funcionario_id(nome)")
          .eq("owner_id", sessao.owner_id)
          .eq("tipo", "inicial")
          .in("ordem_id", ordemIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };
    const { data: upsells } = ordemIds.length
      ? await supabaseAdmin
          .from("os_upsell_oportunidades")
          .select("id, ordem_id, servico_sugerido, motivo, valor_estimado, status")
          .eq("owner_id", sessao.owner_id)
          .in("ordem_id", ordemIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };
    const checklistByOrdem = new Map<string, any>();
    (checklists ?? []).forEach((c: any) => {
      if (!checklistByOrdem.has(c.ordem_id)) checklistByOrdem.set(c.ordem_id, c);
    });
    const upsellsByOrdem = new Map<string, any[]>();
    (upsells ?? []).forEach((u: any) => upsellsByOrdem.set(u.ordem_id, [...(upsellsByOrdem.get(u.ordem_id) ?? []), u]));
    const ordensComChecklist = (ordens ?? []).map((o: any) => ({
      ...o,
      checklist_inicial: checklistByOrdem.get(o.id) ?? null,
      upsell_oportunidades: upsellsByOrdem.get(o.id) ?? [],
    }));

    const minhas = ordensComChecklist.filter((o: any) => o.funcionario_id === funcionario.id);
    const concluidasHoje = minhas.filter((o: any) => o.finalizado_em && new Date(o.finalizado_em) >= new Date(startToday)).length;
    const emAtendimento = ordensComChecklist.filter((o: any) => o.status === "em_lavagem" && o.funcionario_id === funcionario.id);
    const proximas = ordensComChecklist.filter((o: any) => o.status === "aguardando" || o.status === "em_lavagem").slice(0, 12);
    const proximo = proximas.find((o: any) => o.status === "aguardando") ?? null;

    return {
      funcionario,
      cards: {
        veiculosAtribuidos: minhas.filter((o: any) => o.status !== "pronto").length,
        emAtendimento: emAtendimento.length,
        proximoServico: proximo?.servicos?.nome ?? "Livre",
        concluidosHoje: concluidasHoje,
      },
      config: { exigirChecklistInicial },
      fila: proximas,
    };
  });

export const equipeIniciarAtendimento = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(20), ordem_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sessao } = await getEquipeSession(data.token);
    const { data: funcionario } = await supabaseAdmin
      .from("funcionarios")
      .select("id, perm_iniciar_atendimento")
      .eq("id", sessao.funcionario_id)
      .maybeSingle();
    if (!funcionario?.perm_iniciar_atendimento) throw new Error("Sem permissao para iniciar atendimento");
    await assertPodeIniciarLavagem(supabaseAdmin, sessao.owner_id, data.ordem_id);

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("ordens_servico").update({
      status: "em_lavagem",
      iniciado_em: now,
      funcionario_id: funcionario.id,
    } as any).eq("id", data.ordem_id).eq("owner_id", sessao.owner_id);
    if (error) throw error;
    await supabaseAdmin.from("equipe_auditoria").insert({
      owner_id: sessao.owner_id,
      funcionario_id: funcionario.id,
      ordem_id: data.ordem_id,
      acao: "iniciou_atendimento",
      metadata: { iniciado_em: now },
    } as any);
    return { ok: true };
  });

export const listUpsellRegras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const [{ data: regras }, { data: servicos }] = await Promise.all([
      context.supabase.from("upsell_regras").select("*").eq("owner_id", ownerId).order("prioridade"),
      context.supabase.from("servicos").select("id, nome, preco_padrao").eq("owner_id", ownerId).eq("ativo", true).order("nome"),
    ]);
    return {
      regras: (regras?.length ? regras : defaultUpsellRuleRows).map((row: any, index: number) => ({ ...row, prioridade: row.prioridade ?? index + 1 })),
      servicos: servicos ?? [],
      itensChecklist: Object.entries(checklistLabels).map(([chave, label]) => ({ chave, label })),
    };
  });

export const upsertUpsellRegra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    item_chave: z.string().min(1).max(80),
    item_label: z.string().min(1).max(120),
    servico_sugerido: z.string().min(1).max(120),
    servico_id: z.string().uuid().nullable().optional(),
    termos: z.array(z.string().min(1).max(80)).max(12).default([]),
    motivo: z.string().min(1).max(500),
    ativo: z.boolean().default(true),
    prioridade: z.number().int().min(1).max(999).default(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const row = { ...data, owner_id: ownerId, updated_at: new Date().toISOString() };
    const { error } = data.id
      ? await context.supabase.from("upsell_regras").update(row as any).eq("id", data.id).eq("owner_id", ownerId)
      : await context.supabase.from("upsell_regras").insert(row as any);
    if (error) throw error;
    return { ok: true };
  });

const checklistInicialSchema = z.object({
  riscos_visiveis: z.boolean().default(false),
  amassados: z.boolean().default(false),
  vidro_trincado: z.boolean().default(false),
  retrovisor_danificado: z.boolean().default(false),
  farol_lanterna_danificado: z.boolean().default(false),
  rodas_avarias: z.boolean().default(false),
  bancos_manchados: z.boolean().default(false),
  objetos_pessoais: z.boolean().default(false),
  chave_recebida: z.boolean().default(false),
  arranhoes_superficiais: z.boolean().default(false),
  pintura_opaca: z.boolean().default(false),
  farol_amarelado: z.boolean().default(false),
  mau_cheiro_interno: z.boolean().default(false),
  rodas_muito_sujas: z.boolean().default(false),
});

const checklistLabels: Record<string, string> = {
  riscos_visiveis: "Riscos visiveis",
  amassados: "Amassados",
  vidro_trincado: "Vidro trincado",
  retrovisor_danificado: "Retrovisor danificado",
  farol_lanterna_danificado: "Farol ou lanterna danificado",
  rodas_avarias: "Rodas com avarias",
  bancos_manchados: "Bancos manchados",
  objetos_pessoais: "Objetos pessoais no veiculo",
  chave_recebida: "Chave recebida",
  arranhoes_superficiais: "Arranhoes superficiais",
  pintura_opaca: "Pintura opaca",
  farol_amarelado: "Farol amarelado",
  mau_cheiro_interno: "Mau cheiro interno",
  rodas_muito_sujas: "Rodas muito sujas",
};

const upsellRules: Record<string, { servico: string; termos: string[]; motivo: string }> = {
  arranhoes_superficiais: {
    servico: "Polimento tecnico",
    termos: ["polimento tecnico", "polimento comercial", "polimento"],
    motivo: "Identificamos riscos superficiais que podem ser reduzidos com um polimento.",
  },
  pintura_opaca: {
    servico: "Polimento + cristalizacao",
    termos: ["cristalizacao", "polimento"],
    motivo: "A pintura apresenta perda de brilho. Uma cristalizacao pode melhorar a aparencia e proteger a lataria.",
  },
  farol_amarelado: {
    servico: "Revitalizacao de farois",
    termos: ["revitalizacao de farois", "farol", "farois"],
    motivo: "Os farois apresentam sinais de amarelamento. A revitalizacao melhora estetica e visibilidade.",
  },
  bancos_manchados: {
    servico: "Higienizacao interna",
    termos: ["higienizacao interna", "higienizacao", "interna"],
    motivo: "Foram identificadas manchas nos bancos. A higienizacao interna pode ser oferecida ao cliente.",
  },
  mau_cheiro_interno: {
    servico: "Oxi-sanitizacao",
    termos: ["oxi-sanitizacao", "ox sanitizacao", "higienizacao interna", "higienizacao"],
    motivo: "Foi identificado mau cheiro no interior. Uma higienizacao profunda pode resolver o problema.",
  },
  rodas_muito_sujas: {
    servico: "Limpeza tecnica de rodas",
    termos: ["limpeza tecnica de rodas", "rodas", "limpeza de rodas"],
    motivo: "As rodas apresentam sujeira pesada. Ofereca limpeza tecnica como servico adicional.",
  },
};

const defaultUpsellRuleRows = Object.entries(upsellRules).map(([chave, rule], index) => ({
  item_chave: chave,
  item_label: checklistLabels[chave],
  servico_sugerido: rule.servico,
  servico_id: null,
  termos: rule.termos,
  motivo: rule.motivo,
  ativo: true,
  prioridade: index + 1,
}));

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function estruturouChecklistInicial(itens: Record<string, boolean>) {
  return Object.entries(checklistLabels).map(([chave, label]) => ({
    chave,
    label,
    marcado: !!itens[chave],
    severidade: itens[chave] ? "media" : null,
    observacao: null,
    fotos: [],
  }));
}

async function gerarUpsellsChecklistInicial(supabase: any, input: {
  ownerId: string;
  ordemId: string;
  checklistId: string;
  funcionarioId: string;
  itens: Record<string, boolean>;
}) {
  const { data: regrasDb } = await supabase
    .from("upsell_regras")
    .select("id, item_chave, item_label, servico_sugerido, servico_id, termos, motivo, prioridade")
    .eq("owner_id", input.ownerId)
    .eq("ativo", true)
    .order("prioridade", { ascending: true });
  const regras = (regrasDb?.length ? regrasDb : defaultUpsellRuleRows).filter((rule: any) => input.itens[rule.item_chave]);
  const marcados = regras.filter((rule: any) => rule.item_chave && rule.servico_sugerido);
  if (marcados.length === 0) return [];

  const { data: servicos } = await supabase
    .from("servicos")
    .select("id, nome, preco_padrao")
    .eq("owner_id", input.ownerId)
    .eq("ativo", true);

  const rows = marcados.map((rule: any) => {
    const match = (servicos ?? []).find((s: any) => {
      if (rule.servico_id && s.id === rule.servico_id) return true;
      const nome = normalizeText(s.nome ?? "");
      return (rule.termos ?? []).some((termo: string) => nome.includes(normalizeText(termo)));
    });
    return {
      owner_id: input.ownerId,
      ordem_id: input.ordemId,
      checklist_id: input.checklistId,
      funcionario_id: input.funcionarioId,
      servico_id: match?.id ?? null,
      origem_item_chave: rule.item_chave,
      origem_item_label: rule.item_label ?? checklistLabels[rule.item_chave] ?? rule.item_chave,
      servico_sugerido: match?.nome ?? rule.servico_sugerido,
      motivo: rule.motivo,
      valor_estimado: match?.preco_padrao ?? null,
      status: "sugerida",
    };
  });

  const { data, error } = await supabase
    .from("os_upsell_oportunidades")
    .insert(rows as any)
    .select("*");
  if (error) throw error;
  return data ?? [];
}

export const equipeConcluirChecklistInicial = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().min(20),
    ordem_id: z.string().uuid(),
    itens: checklistInicialSchema,
    observacoes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sessao } = await getEquipeSession(data.token);
    const { data: funcionario } = await supabaseAdmin
      .from("funcionarios")
      .select("id, perm_realizar_checklist, perm_iniciar_atendimento")
      .eq("id", sessao.funcionario_id)
      .maybeSingle();
    if (!funcionario?.perm_realizar_checklist) throw new Error("Sem permissao para realizar checklist");
    if (!funcionario?.perm_iniciar_atendimento) throw new Error("Sem permissao para iniciar atendimento");

    const now = new Date().toISOString();
    const itensEstruturados = estruturouChecklistInicial(data.itens);
    const { data: checklistRow, error: insertError } = await supabaseAdmin.from("os_checklists").insert({
      owner_id: sessao.owner_id,
      ordem_id: data.ordem_id,
      funcionario_id: funcionario.id,
      tipo: "inicial",
      status: "concluido",
      itens: itensEstruturados,
      observacoes: data.observacoes ?? null,
    } as any).select("id").single();
    if (insertError) throw insertError;
    const oportunidades = await gerarUpsellsChecklistInicial(supabaseAdmin, {
      ownerId: sessao.owner_id,
      ordemId: data.ordem_id,
      checklistId: checklistRow.id,
      funcionarioId: funcionario.id,
      itens: data.itens,
    });
    const { error } = await supabaseAdmin.from("ordens_servico").update({
      status: "em_lavagem",
      iniciado_em: now,
      funcionario_id: funcionario.id,
      checklist_inicial_status: "concluido",
      checklist_inicial_funcionario_id: funcionario.id,
      checklist_inicial_em: now,
    } as any).eq("id", data.ordem_id).eq("owner_id", sessao.owner_id);
    if (error) throw error;
    await supabaseAdmin.from("equipe_auditoria").insert({
      owner_id: sessao.owner_id,
      funcionario_id: funcionario.id,
      ordem_id: data.ordem_id,
      acao: "concluiu_checklist_inicial",
      metadata: { itens: itensEstruturados, observacoes: data.observacoes ?? null, oportunidades: oportunidades.length },
    } as any);
    return { ok: true, oportunidades };
  });

export const equipePularChecklistInicial = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().min(20),
    ordem_id: z.string().uuid(),
    observacoes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sessao } = await getEquipeSession(data.token);
    const exigir = await getExigeChecklistInicial(supabaseAdmin, sessao.owner_id);
    if (exigir) throw new Error("Conclua o checklist inicial antes de iniciar o atendimento.");
    const { data: funcionario } = await supabaseAdmin
      .from("funcionarios")
      .select("id, perm_iniciar_atendimento")
      .eq("id", sessao.funcionario_id)
      .maybeSingle();
    if (!funcionario?.perm_iniciar_atendimento) throw new Error("Sem permissao para iniciar atendimento");

    const now = new Date().toISOString();
    const { error: insertError } = await supabaseAdmin.from("os_checklists").insert({
      owner_id: sessao.owner_id,
      ordem_id: data.ordem_id,
      funcionario_id: funcionario.id,
      tipo: "inicial",
      status: "pulado",
      itens: estruturouChecklistInicial({}),
      observacoes: data.observacoes ?? null,
    } as any);
    if (insertError) throw insertError;
    const { error } = await supabaseAdmin.from("ordens_servico").update({
      status: "em_lavagem",
      iniciado_em: now,
      funcionario_id: funcionario.id,
      checklist_inicial_status: "pulado",
      checklist_inicial_funcionario_id: funcionario.id,
      checklist_inicial_em: now,
    } as any).eq("id", data.ordem_id).eq("owner_id", sessao.owner_id);
    if (error) throw error;
    await supabaseAdmin.from("equipe_auditoria").insert({
      owner_id: sessao.owner_id,
      funcionario_id: funcionario.id,
      ordem_id: data.ordem_id,
      acao: "pulou_checklist_inicial",
      metadata: { observacoes: data.observacoes ?? null },
    } as any);
    return { ok: true };
  });

export const atualizarUpsellOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    status: z.enum(["sugerida", "oferecida", "aceita", "recusada", "ignorada"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const { error, data: oportunidade } = await context.supabase
      .from("os_upsell_oportunidades")
      .update({ status: data.status, updated_at: new Date().toISOString() } as any)
      .eq("id", data.id)
      .eq("owner_id", ownerId)
      .select("id, ordem_id, servico_sugerido, servico_id, valor_estimado, funcionario_id, motivo, origem_item_label")
      .maybeSingle();
    if (error) throw error;
    if (data.status === "aceita" && oportunidade) {
      const { data: ordem } = await context.supabase
        .from("ordens_servico")
        .select("cliente_id")
        .eq("id", oportunidade.ordem_id)
        .eq("owner_id", ownerId)
        .maybeSingle();
      const { data: existente } = await context.supabase
        .from("receita_influenciada")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("origem", "UPSELL_CHECKLIST")
        .eq("referencia_tipo", "os_upsell_oportunidade")
        .eq("referencia_id", oportunidade.id)
        .maybeSingle();
      if (!existente) {
        await context.supabase.from("receita_influenciada").insert({
          owner_id: ownerId,
          ordem_id: oportunidade.ordem_id,
          cliente_id: ordem?.cliente_id ?? null,
          funcionario_id: oportunidade.funcionario_id ?? null,
          origem: "UPSELL_CHECKLIST",
          valor: Number(oportunidade.valor_estimado ?? 0),
          descricao: `Upsell aceito: ${oportunidade.servico_sugerido}`,
          referencia_tipo: "os_upsell_oportunidade",
          referencia_id: oportunidade.id,
          metadata: {
            servico_sugerido: oportunidade.servico_sugerido,
            servico_id: oportunidade.servico_id,
            motivo: oportunidade.motivo,
            origem_item: oportunidade.origem_item_label,
          },
        } as any);
      }
    }
    return { ok: true };
  });

export const equipeFinalizarAtendimento = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().min(20),
    ordem_id: z.string().uuid(),
    observacoes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sessao } = await getEquipeSession(data.token);
    const { data: funcionario } = await supabaseAdmin
      .from("funcionarios")
      .select("id, perm_finalizar_atendimento")
      .eq("id", sessao.funcionario_id)
      .maybeSingle();
    if (!funcionario?.perm_finalizar_atendimento) throw new Error("Sem permissao para finalizar atendimento");

    const { data: ordem } = await supabaseAdmin
      .from("ordens_servico")
      .select("observacoes")
      .eq("id", data.ordem_id)
      .eq("owner_id", sessao.owner_id)
      .maybeSingle();
    const now = new Date().toISOString();
    const obs = data.observacoes
      ? [ordem?.observacoes, `[Equipe] ${data.observacoes}`].filter(Boolean).join("\n")
      : ordem?.observacoes;
    const { error } = await supabaseAdmin.from("ordens_servico").update({
      status: "pronto",
      finalizado_em: now,
      observacoes: obs ?? null,
      funcionario_id: funcionario.id,
    } as any).eq("id", data.ordem_id).eq("owner_id", sessao.owner_id);
    if (error) throw error;
    await supabaseAdmin.from("equipe_auditoria").insert({
      owner_id: sessao.owner_id,
      funcionario_id: funcionario.id,
      ordem_id: data.ordem_id,
      acao: "finalizou_atendimento",
      metadata: { finalizado_em: now, observacoes: data.observacoes ?? null },
    } as any);
    return { ok: true };
  });

export const listComissoesServico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { funcionario_id: string }) => z.object({ funcionario_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
    assertTenantRole(role, ADMIN_ROLES);
    const { data: rows } = await context.supabase
      .from("comissoes_servico")
      .select("id, servico_id, tipo, valor")
      .eq("owner_id", ownerId)
      .eq("funcionario_id", data.funcionario_id);
    return { itens: rows ?? [] };
  });

export const upsertComissoesServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    funcionario_id: z.string().uuid(),
    itens: z.array(z.object({
      servico_id: z.string().uuid(),
      tipo: z.enum(["fixo", "percentual"]),
      valor: z.number().min(0).max(100000),
    })),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId, role } = await getOwnerScope(supabase, userId);
    assertTenantRole(role, ADMIN_ROLES);
    const { error: delErr } = await supabase.from("comissoes_servico")
      .delete().eq("owner_id", ownerId).eq("funcionario_id", data.funcionario_id);
    if (delErr) throw delErr;
    const rows = data.itens
      .filter((i) => i.valor > 0)
      .map((i) => ({ ...i, owner_id: ownerId, funcionario_id: data.funcionario_id }));
    if (rows.length > 0) {
      const { error } = await supabase.from("comissoes_servico").insert(rows);
      if (error) throw error;
    }
    return { ok: true };
  });

// ============ EQUIPE — PAINEL COMPLETO ============
function rangeForPeriodo(periodo: string, inicio?: string, fim?: string) {
  const now = new Date();
  let start = new Date();
  let end = new Date();
  end.setHours(23, 59, 59, 999);
  if (periodo === "semana") { start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0); }
  else if (periodo === "quinzena") { start.setDate(now.getDate() - 15); start.setHours(0, 0, 0, 0); }
  else if (periodo === "custom" && inicio && fim) {
    start = new Date(inicio + "T00:00:00");
    end = new Date(fim + "T23:59:59");
  } else { start = new Date(now.getFullYear(), now.getMonth(), 1); }
  return { start, end };
}

function ordemComissaoDate(o: any) {
  return o.entregue_em ?? o.created_at;
}

function calcComissaoOrdem(ordem: any, funcionario: any, regrasServico: Map<string, any>) {
  let tipo = funcionario.comissao_tipo;
  let valorRegra = Number(funcionario.comissao_valor ?? 0);

  if (funcionario.comissao_modo === "por_servico" && ordem.servico_id) {
    const regra = regrasServico.get(`${funcionario.id}:${ordem.servico_id}`);
    if (regra) {
      tipo = regra.tipo;
      valorRegra = Number(regra.valor ?? 0);
    }
  }

  const valor = tipo === "percentual"
    ? Math.round((Number(ordem.valor ?? 0) * valorRegra / 100) * 100) / 100
    : valorRegra;

  return { tipo, valor };
}

async function ensureComissoesEntregues(
  supabase: any,
  ownerId: string,
  start: Date,
  end: Date,
  funcionarioId?: string,
) {
  const startIso = start.toISOString();
  const endMs = end.getTime();
  const [{ data: funcionarios }, { data: ordens }, { data: regrasServico }] = await Promise.all([
    supabase.from("funcionarios")
      .select("id, comissao_tipo, comissao_valor, comissao_modo")
      .eq("owner_id", ownerId),
    supabase.from("ordens_servico")
      .select("id, valor, status, funcionario_id, servico_id, entregue_em, created_at")
      .eq("owner_id", ownerId)
      .eq("status", "entregue")
      .or(`entregue_em.gte.${startIso},created_at.gte.${startIso}`),
    supabase.from("comissoes_servico")
      .select("funcionario_id, servico_id, tipo, valor")
      .eq("owner_id", ownerId),
  ]);

  const funcionariosById = new Map((funcionarios ?? []).map((f: any) => [f.id, f]));
  const regrasByFuncServico = new Map<string, any>(
    (regrasServico ?? []).map((r: any) => [`${r.funcionario_id}:${r.servico_id}`, r] as [string, any]),
  );
  const ordensElegiveis = (ordens ?? []).filter((o: any) => {
    const ref = ordemComissaoDate(o);
    if (!ref || !o.funcionario_id) return false;
    if (funcionarioId && o.funcionario_id !== funcionarioId) return false;
    const t = new Date(ref).getTime();
    return t >= start.getTime() && t <= endMs;
  });

  if (ordensElegiveis.length === 0) return;

  const { data: existentes } = await supabase
    .from("comissoes")
    .select("ordem_id")
    .eq("owner_id", ownerId)
    .in("ordem_id", ordensElegiveis.map((o: any) => o.id));

  const existentesIds = new Set((existentes ?? []).map((c: any) => c.ordem_id));
  const novas = ordensElegiveis
    .filter((o: any) => !existentesIds.has(o.id))
    .map((o: any) => {
      const f = funcionariosById.get(o.funcionario_id);
      if (!f) return null;
      const { tipo, valor } = calcComissaoOrdem(o, f, regrasByFuncServico);
      if (valor <= 0) return null;
      return {
        owner_id: ownerId,
        funcionario_id: o.funcionario_id,
        ordem_id: o.id,
        valor,
        tipo,
        created_at: ordemComissaoDate(o),
      };
    })
    .filter(Boolean);

  if (novas.length > 0) {
    const { error } = await supabase.from("comissoes").insert(novas);
    if (error) throw error;
  }
}

export const getEquipePainel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    periodo: z.enum(["semana", "quinzena", "mes", "custom"]).default("mes"),
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId, role } = await getOwnerScope(supabase, userId);
    const canVerComissoes = ADMIN_ROLES.includes(role);
    const { start, end } = rangeForPeriodo(data.periodo, data.inicio, data.fim);
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    if (canVerComissoes) await ensureComissoesEntregues(supabase, ownerId, start, end);

    const [{ data: func }, { data: ordens }, { data: comissoes }, { data: pagamentos }, { data: empresa }] = await Promise.all([
      supabase.from("funcionarios")
        .select("id, nome, ativo, comissao_tipo, comissao_valor, comissao_modo, auth_user_id, cargo, telefone, email, avatar_url, pin_digits, pin_hash, perm_iniciar_atendimento, perm_finalizar_atendimento, perm_realizar_checklist, perm_ver_apenas_atribuidos, perm_ver_todos_veiculos, especialidades, horario_inicio, horario_fim, dias_disponiveis, capacidade_por_horario")
        .eq("owner_id", ownerId).order("nome"),
      supabase.from("ordens_servico")
        .select("id, valor, status, funcionario_id, iniciado_em, entregue_em, created_at")
        .eq("owner_id", ownerId)
        .or(`entregue_em.gte.${start.toISOString()},created_at.gte.${start.toISOString()}`),
      canVerComissoes
        ? supabase.from("comissoes")
          .select("funcionario_id, valor, pagamento_id, created_at")
          .eq("owner_id", ownerId)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
        : Promise.resolve({ data: [] as any[] }),
      canVerComissoes
        ? supabase.from("pagamentos_comissao")
          .select("funcionario_id, valor, pago_em")
          .eq("owner_id", ownerId)
          .order("pago_em", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("empresa")
        .select("slug, nome_fantasia")
        .eq("owner_id", ownerId)
        .maybeSingle(),
    ]);

    const ultimoPagto = new Map<string, { valor: number; pago_em: string }>();
    (pagamentos ?? []).forEach((p: any) => {
      if (!ultimoPagto.has(p.funcionario_id)) {
        ultimoPagto.set(p.funcionario_id, { valor: Number(p.valor), pago_em: p.pago_em });
      }
    });

    const byFunc = new Map<string, { lavagens: number; receita: number; comissaoTotal: number; comissaoAberta: number }>();
    (func ?? []).forEach((f: any) => byFunc.set(f.id, { lavagens: 0, receita: 0, comissaoTotal: 0, comissaoAberta: 0 }));
    (ordens ?? []).forEach((o: any) => {
      if (!o.funcionario_id || o.status !== "entregue") return;
      const ref = ordemComissaoDate(o);
      if (!ref) return;
      const t = new Date(ref).getTime();
      if (t < start.getTime() || t > end.getTime()) return;
      const cur = byFunc.get(o.funcionario_id) ?? { lavagens: 0, receita: 0, comissaoTotal: 0, comissaoAberta: 0 };
      cur.lavagens += 1; cur.receita += Number(o.valor ?? 0);
      byFunc.set(o.funcionario_id, cur);
    });
    (comissoes ?? []).forEach((c: any) => {
      const cur = byFunc.get(c.funcionario_id) ?? { lavagens: 0, receita: 0, comissaoTotal: 0, comissaoAberta: 0 };
      cur.comissaoTotal += Number(c.valor ?? 0);
      if (!c.pagamento_id) cur.comissaoAberta += Number(c.valor ?? 0);
      byFunc.set(c.funcionario_id, cur);
    });

    const colaboradores = (func ?? []).map((f: any) => {
      const m = byFunc.get(f.id)!;
      const status: "a_receber" | "pago" | "sem_comissao" =
        m.comissaoAberta > 0.005 ? "a_receber" : (m.comissaoTotal > 0 ? "pago" : "sem_comissao");
      const tipoLabel = f.comissao_modo === "por_servico"
        ? "Personalizado por serviço"
        : f.comissao_tipo === "percentual"
          ? `${Number(f.comissao_valor)}% por OS`
          : `R$ ${Number(f.comissao_valor).toFixed(2)} por OS`;
      return {
        id: f.id, nome: f.nome, cargo: f.cargo, telefone: f.telefone, email: f.email,
        avatar_url: f.avatar_url,
        pin_digits: f.pin_digits ?? 4,
        pin_configurado: !!f.pin_hash,
        perm_iniciar_atendimento: f.perm_iniciar_atendimento ?? true,
        perm_finalizar_atendimento: f.perm_finalizar_atendimento ?? true,
        perm_realizar_checklist: f.perm_realizar_checklist ?? true,
        perm_ver_apenas_atribuidos: f.perm_ver_apenas_atribuidos ?? true,
        perm_ver_todos_veiculos: f.perm_ver_todos_veiculos ?? false,
        ativo: f.ativo, vinculado: !!f.auth_user_id,
        comissao_tipo: canVerComissoes ? f.comissao_tipo : null,
        comissao_valor: canVerComissoes ? Number(f.comissao_valor) : null,
        comissao_modo: canVerComissoes ? f.comissao_modo : null,
        tipo_label: canVerComissoes ? tipoLabel : null,
        lavagens: m.lavagens, receita: m.receita,
        comissao_acumulada: canVerComissoes ? m.comissaoAberta : null,
        comissao_total: canVerComissoes ? m.comissaoTotal : null,
        status: canVerComissoes ? status : null,
        ultimo_pagamento: canVerComissoes ? (ultimoPagto.get(f.id) ?? null) : null,
      };
    });

    const totalAPagar = canVerComissoes
      ? colaboradores.reduce((s, c) => s + Number(c.comissao_acumulada ?? 0), 0)
      : null;
    const totalLavagens = colaboradores.reduce((s, c) => s + c.lavagens, 0);
    const ativosHoje = new Set(
      (ordens ?? [])
        .filter((o: any) => o.iniciado_em && new Date(o.iniciado_em) >= startToday && o.funcionario_id)
        .map((o: any) => o.funcionario_id),
    ).size;
    const melhor = [...colaboradores].sort((a, b) => b.lavagens - a.lavagens)[0] ?? null;

    return {
      colaboradores: colaboradores.sort((a, b) => b.receita - a.receita),
      periodo: { inicio: start.toISOString().slice(0, 10), fim: end.toISOString().slice(0, 10) },
      empresa: empresa ?? null,
      canVerComissoes,
      cards: {
        totalAPagar, totalLavagens, ativosHoje,
        melhor: melhor && melhor.lavagens > 0
          ? { id: melhor.id, nome: melhor.nome, lavagens: melhor.lavagens, receita: melhor.receita }
          : null,
      },
    };
  });

export const marcarPagamentoComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    funcionario_id: z.string().uuid(),
    periodo_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodo_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    observacao: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId, role } = await getOwnerScope(supabase, userId);
    assertTenantRole(role, ADMIN_ROLES);
    const inicioIso = new Date(data.periodo_inicio + "T00:00:00").toISOString();
    const fimIso = new Date(data.periodo_fim + "T23:59:59").toISOString();
    await ensureComissoesEntregues(
      supabase,
      ownerId,
      new Date(inicioIso),
      new Date(fimIso),
      data.funcionario_id,
    );
    const { data: abertas, error: eList } = await supabase
      .from("comissoes")
      .select("id, valor")
      .eq("owner_id", ownerId)
      .eq("funcionario_id", data.funcionario_id)
      .is("pagamento_id", null)
      .gte("created_at", inicioIso)
      .lte("created_at", fimIso);
    if (eList) throw eList;
    const valor = (abertas ?? []).reduce((s, c) => s + Number(c.valor ?? 0), 0);
    if (valor <= 0) throw new Error("Nada a pagar no período selecionado.");
    const { data: pag, error: ePag } = await supabase.from("pagamentos_comissao").insert({
      owner_id: ownerId, funcionario_id: data.funcionario_id,
      periodo_inicio: data.periodo_inicio, periodo_fim: data.periodo_fim,
      valor, observacao: data.observacao ?? null,
    }).select("id").single();
    if (ePag) throw ePag;
    const ids = (abertas ?? []).map((c) => c.id);
    if (ids.length > 0) {
      const { error: eUpd } = await supabase.from("comissoes")
        .update({ pagamento_id: pag.id }).in("id", ids);
      if (eUpd) throw eUpd;
    }
    return { ok: true, valor, quantidade_servicos: ids.length, pagamento_id: pag.id };
  });

export const listPagamentosComissao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ funcionario_id: z.string().uuid(), limit: z.number().int().min(1).max(50).default(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId, role } = await getOwnerScope(context.supabase, context.userId);
    assertTenantRole(role, ADMIN_ROLES);
    const { data: rows } = await context.supabase
      .from("pagamentos_comissao")
      .select("id, valor, pago_em, periodo_inicio, periodo_fim, observacao")
      .eq("owner_id", ownerId)
      .eq("funcionario_id", data.funcionario_id)
      .order("pago_em", { ascending: false })
      .limit(data.limit);
    const ids = (rows ?? []).map((p: any) => p.id);
    const { data: comissoes } = ids.length > 0
      ? await context.supabase
        .from("comissoes")
        .select("pagamento_id")
        .eq("owner_id", ownerId)
        .in("pagamento_id", ids)
      : { data: [] };
    const qtdByPagamento = new Map<string, number>();
    (comissoes ?? []).forEach((c: any) => {
      if (!c.pagamento_id) return;
      qtdByPagamento.set(c.pagamento_id, (qtdByPagamento.get(c.pagamento_id) ?? 0) + 1);
    });
    return {
      pagamentos: (rows ?? []).map((p: any) => ({
        ...p,
        quantidade_servicos: qtdByPagamento.get(p.id) ?? 0,
      })),
    };
  });

// ============ CLIENTES — UPDATE COMPLETO ============
export const updateClienteCompleto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    nome: z.string().min(1).max(120),
    telefone: z.string().max(20).optional().nullable(),
    whatsapp: z.string().max(20).optional().nullable(),
    email: z.string().email().max(160).optional().nullable().or(z.literal("")),
    observacoes: z.string().max(1000).optional().nullable(),
    veiculo: z.object({
      id: z.string().uuid().optional(),
      placa: z.string().min(1).max(10),
      modelo: z.string().max(60).optional().nullable(),
      marca: z.string().max(60).optional().nullable(),
      cor: z.string().max(30).optional().nullable(),
      vehicle_year: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional().nullable(),
    }).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const patch: any = {
      nome: data.nome.trim(),
      telefone: data.telefone || null,
      whatsapp: data.whatsapp || null,
      email: (data.email && data.email !== "") ? data.email : null,
      observacoes: data.observacoes || null,
    };
    const { error: eC } = await supabase.from("clientes")
      .update(patch).eq("id", data.id).eq("owner_id", ownerId);
    if (eC) throw eC;
    if (data.veiculo) {
      const v = {
        placa: data.veiculo.placa.toUpperCase().trim(),
        modelo: data.veiculo.modelo || null,
        marca: data.veiculo.marca || null,
        cor: data.veiculo.cor || null,
        vehicle_year: data.veiculo.vehicle_year ?? null,
      };
      if (data.veiculo.id) {
        const { error } = await supabase.from("veiculos")
          .update(v).eq("id", data.veiculo.id).eq("owner_id", ownerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("veiculos").insert({
          ...v, owner_id: ownerId, cliente_id: data.id,
        });
        if (error) throw error;
      }
    }
    return { ok: true };
  });

export const getEquipeMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { periodo: "hoje" | "semana" | "mes" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId, role } = await getOwnerScope(supabase, userId);
    const canVerComissoes = ADMIN_ROLES.includes(role);
    const now = new Date();
    const start = new Date();
    if (data.periodo === "hoje") start.setHours(0, 0, 0, 0);
    else if (data.periodo === "semana") start.setDate(now.getDate() - 7);
    else { start.setDate(1); start.setHours(0, 0, 0, 0); }
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);

    const [{ data: ordens }, { data: func }, { data: comissoes }] = await Promise.all([
      supabase.from("ordens_servico")
        .select("id, valor, status, funcionario_id, iniciado_em, finalizado_em, entregue_em, created_at")
        .eq("owner_id", ownerId)
        .gte("created_at", start.toISOString()),
      supabase.from("funcionarios").select("id, nome, ativo").eq("owner_id", ownerId),
      canVerComissoes
        ? supabase.from("comissoes").select("funcionario_id, valor, created_at").eq("owner_id", ownerId).gte("created_at", start.toISOString())
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const lavadosHoje = (ordens ?? []).filter(o => o.entregue_em && new Date(o.entregue_em) >= startToday).length;
    const colabAtivosHoje = new Set(
      (ordens ?? [])
        .filter(o => o.iniciado_em && new Date(o.iniciado_em) >= startToday && o.funcionario_id)
        .map(o => o.funcionario_id)
    ).size;
    const tempos = (ordens ?? [])
      .filter(o => o.iniciado_em && o.finalizado_em)
      .map(o => (new Date(o.finalizado_em!).getTime() - new Date(o.iniciado_em!).getTime()) / 60000);
    const tempoMedio = tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : 0;
    const valorEquipe = (ordens ?? []).filter(o => o.status === "entregue").reduce((s, o) => s + Number(o.valor ?? 0), 0);

    const byFunc = new Map<string, { lavagens: number; receita: number; comissao: number }>();
    (func ?? []).forEach(f => byFunc.set(f.id, { lavagens: 0, receita: 0, comissao: 0 }));
    (ordens ?? []).forEach(o => {
      if (!o.funcionario_id || o.status !== "entregue") return;
      const cur = byFunc.get(o.funcionario_id) ?? { lavagens: 0, receita: 0, comissao: 0 };
      cur.lavagens += 1; cur.receita += Number(o.valor ?? 0);
      byFunc.set(o.funcionario_id, cur);
    });
    (comissoes ?? []).forEach(c => {
      const cur = byFunc.get(c.funcionario_id) ?? { lavagens: 0, receita: 0, comissao: 0 };
      cur.comissao += Number(c.valor ?? 0);
      byFunc.set(c.funcionario_id, cur);
    });

    const ranking = (func ?? []).map(f => {
      const metrics = byFunc.get(f.id)!;
      return { id: f.id, nome: f.nome, ...metrics, comissao: canVerComissoes ? metrics.comissao : null };
    })
      .sort((a, b) => b.lavagens - a.lavagens);

    return {
      cards: { lavadosHoje, colabAtivosHoje, tempoMedio, valorEquipe },
      ranking,
      canVerComissoes,
    };
  });

// ============ AGENDAMENTOS ============
export type AgendamentoStatus = "agendado" | "confirmado" | "em_andamento" | "concluido" | "cancelado" | "nao_compareceu";

async function getFuncionariosDisponiveisInterno(
  supabase: any,
  ownerId: string,
  dataAgendada: string,
  horaAgendada: string,
  servicoId?: string | null,
) {
  const hora = horaAgendada.length === 5 ? `${horaAgendada}:00` : horaAgendada;
  const diaSemana = new Date(`${dataAgendada}T12:00:00`).getDay();
  const [{ data: funcionarios }, { data: ocupados }, { data: servico }] = await Promise.all([
    supabase.from("funcionarios")
      .select("id, nome, ativo, cargo, especialidades, horario_inicio, horario_fim, dias_disponiveis, capacidade_por_horario, tempo_medio_servicos")
      .eq("owner_id", ownerId)
      .eq("ativo", true)
      .order("nome"),
    supabase.from("agendamentos")
      .select("id, funcionario_id, status")
      .eq("owner_id", ownerId)
      .eq("data_agendada", dataAgendada)
      .eq("hora_agendada", hora)
      .not("status", "in", "(cancelado,nao_compareceu)"),
    servicoId
      ? supabase.from("servicos").select("id, nome").eq("id", servicoId).eq("owner_id", ownerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ocupacao = new Map<string, number>();
  (ocupados ?? []).forEach((a: any) => {
    if (a.funcionario_id) ocupacao.set(a.funcionario_id, (ocupacao.get(a.funcionario_id) ?? 0) + 1);
  });
  const servicoNome = (servico as any)?.nome?.toLowerCase();

  return (funcionarios ?? []).map((f: any) => {
    const inicio = String(f.horario_inicio ?? "08:00").slice(0, 5);
    const fim = String(f.horario_fim ?? "18:00").slice(0, 5);
    const dias = f.dias_disponiveis ?? [1,2,3,4,5,6];
    const especialidades = (f.especialidades ?? []) as string[];
    const capacidade = Math.max(1, Number(f.capacidade_por_horario ?? 1));
    const qtd = ocupacao.get(f.id) ?? 0;
    const dentroHorario = hora.slice(0, 5) >= inicio && hora.slice(0, 5) < fim;
    const diaDisponivel = dias.includes(diaSemana);
    const especialidadeOk = !servicoNome || especialidades.length === 0
      || especialidades.some((e) => servicoNome.includes(String(e).toLowerCase()) || String(e).toLowerCase().includes(servicoNome));
    const disponivel = dentroHorario && diaDisponivel && especialidadeOk && qtd < capacidade;
    return {
      ...f,
      ocupacao: qtd,
      capacidade,
      disponivel,
      motivo_indisponivel: !diaDisponivel ? "Fora do dia de trabalho"
        : !dentroHorario ? "Fora do horário"
        : !especialidadeOk ? "Especialidade incompatível"
        : qtd >= capacidade ? "Lotado"
        : null,
    };
  });
}

export const getColaboradoresDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    data_agendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hora_agendada: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    servico_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const colaboradores = await getFuncionariosDisponiveisInterno(
      context.supabase,
      ownerId,
      data.data_agendada,
      data.hora_agendada,
      data.servico_id,
    );
    return { colaboradores };
  });

export const listAgendamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date?: string; from?: string; to?: string; leva_traz?: boolean }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    let q = supabase.from("agendamentos")
      .select(`id, data_agendada, hora_agendada, status, observacoes, ordem_id, created_at,
               leva_traz, endereco_retirada, endereco_devolucao, horario_retirada, horario_devolucao,
               observacoes_leva_traz, taxa_leva_traz, leva_traz_status,
               cliente_id, veiculo_id, servico_id, funcionario_id,
               clientes:cliente_id(nome, telefone),
               veiculos:veiculo_id(placa, modelo),
               servicos:servico_id(nome, preco_padrao),
               funcionarios:funcionario_id(nome)`)
      .eq("owner_id", ownerId)
      .order("data_agendada", { ascending: true })
      .order("hora_agendada", { ascending: true });
    if (data.date) q = q.eq("data_agendada", data.date);
    if (data.from) q = q.gte("data_agendada", data.from);
    if (data.to) q = q.lte("data_agendada", data.to);
    if (data.leva_traz) q = q.eq("leva_traz", true);
    const { data: rows, error } = await q.limit(500);
    if (error) throw error;
    return { agendamentos: rows ?? [] };
  });

export const agendamentoStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const [{ data: hoje }, { data: mes }] = await Promise.all([
      supabase.from("agendamentos").select("id, status, leva_traz").eq("owner_id", ownerId).eq("data_agendada", today),
      supabase.from("agendamentos").select("id, status, leva_traz, data_agendada").eq("owner_id", ownerId).gte("data_agendada", monthAgo),
    ]);
    const h = hoje ?? [];
    const m = mes ?? [];
    const totalMes = m.length;
    const compareceu = m.filter(a => a.status === "concluido" || a.status === "em_andamento").length;
    const naoCompareceu = m.filter(a => a.status === "nao_compareceu").length;
    return {
      hoje: h.length,
      confirmadosHoje: h.filter(a => a.status === "confirmado").length,
      emAndamentoHoje: h.filter(a => a.status === "em_andamento").length,
      naoCompareceuHoje: h.filter(a => a.status === "nao_compareceu").length,
      naoCompareceuMes: naoCompareceu,
      taxaComparecimento: totalMes ? compareceu / totalMes : 0,
      levaTrazHoje: h.filter(a => a.leva_traz).length,
      levaTrazSemana: m.filter(a => a.leva_traz && a.data_agendada >= today && a.data_agendada <= weekAhead).length,
      totalMes,
    };
  });

export const createAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    cliente_id: z.string().uuid(),
    veiculo_id: z.string().uuid().nullable().optional(),
    servico_id: z.string().uuid().nullable().optional(),
    funcionario_id: z.string().uuid().nullable().optional(),
    data_agendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hora_agendada: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    observacoes: z.string().max(500).nullable().optional(),
    leva_traz: z.boolean().default(false),
    endereco_retirada: z.string().max(300).nullable().optional(),
    endereco_devolucao: z.string().max(300).nullable().optional(),
    horario_retirada: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
    horario_devolucao: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
    observacoes_leva_traz: z.string().max(500).nullable().optional(),
    taxa_leva_traz: z.number().min(0).default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const hora = data.hora_agendada.length === 5 ? data.hora_agendada + ":00" : data.hora_agendada;
    const { data: cfg } = await supabase.from("agenda_config").select("capacidade_simultanea").eq("owner_id", ownerId).maybeSingle();
    const cap = cfg?.capacidade_simultanea ?? 1;
    const { count } = await supabase.from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("data_agendada", data.data_agendada)
      .eq("hora_agendada", hora)
      .not("status", "in", "(cancelado,nao_compareceu)");
    if ((count ?? 0) >= cap) {
      throw new Error(`Horário lotado (capacidade ${cap}).`);
    }
    let funcionario_id = data.funcionario_id ?? null;
    const colaboradores = await getFuncionariosDisponiveisInterno(supabase, ownerId, data.data_agendada, hora, data.servico_id);
    if (funcionario_id) {
      const escolhido = colaboradores.find((c: any) => c.id === funcionario_id);
      if (!escolhido?.disponivel) throw new Error(escolhido?.motivo_indisponivel ?? "Colaborador indisponível neste horário.");
    } else {
      funcionario_id = colaboradores
        .filter((c: any) => c.disponivel)
        .sort((a: any, b: any) => (a.ocupacao / a.capacidade) - (b.ocupacao / b.capacidade) || a.ocupacao - b.ocupacao)[0]?.id ?? null;
    }
    const horario_retirada = data.horario_retirada
      ? (data.horario_retirada.length === 5 ? `${data.horario_retirada}:00` : data.horario_retirada)
      : null;
    const horario_devolucao = data.horario_devolucao
      ? (data.horario_devolucao.length === 5 ? `${data.horario_devolucao}:00` : data.horario_devolucao)
      : null;
    const { error, data: row } = await supabase.from("agendamentos").insert({
      ...data, funcionario_id, hora_agendada: hora, horario_retirada, horario_devolucao, owner_id: ownerId,
    }).select().single();
    if (error) throw error;
    return { agendamento: row };
  });

export const updateAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    funcionario_id: z.string().uuid().nullable().optional(),
    servico_id: z.string().uuid().nullable().optional(),
    data_agendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    hora_agendada: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    observacoes: z.string().max(500).nullable().optional(),
    leva_traz: z.boolean().optional(),
    endereco_retirada: z.string().max(300).nullable().optional(),
    endereco_devolucao: z.string().max(300).nullable().optional(),
    horario_retirada: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
    horario_devolucao: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
    observacoes_leva_traz: z.string().max(500).nullable().optional(),
    taxa_leva_traz: z.number().min(0).optional(),
    leva_traz_status: z.enum(["pendente","retirada_agendada","retirado","em_servico","pronto_para_devolucao","devolvido","cancelado"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const patch: any = { ...rest };
    if (patch.hora_agendada?.length === 5) patch.hora_agendada = `${patch.hora_agendada}:00`;
    if (patch.horario_retirada?.length === 5) patch.horario_retirada = `${patch.horario_retirada}:00`;
    if (patch.horario_devolucao?.length === 5) patch.horario_devolucao = `${patch.horario_devolucao}:00`;
    const { error } = await context.supabase.from("agendamentos")
      .update(patch).eq("id", id).eq("owner_id", ownerId);
    if (error) throw error;
    return { ok: true };
  });

export const updateAgendamentoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    status: z.enum(["agendado","confirmado","em_andamento","concluido","cancelado","nao_compareceu"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const patch: any = { status: data.status };
    if (data.status === "confirmado") patch.confirmado_em = new Date().toISOString();
    if (data.status === "cancelado") patch.cancelado_em = new Date().toISOString();
    if (data.status === "concluido") patch.concluido_em = new Date().toISOString();
    const { error } = await supabase.from("agendamentos").update(patch).eq("id", data.id).eq("owner_id", ownerId);
    if (error) throw error;
    return { ok: true };
  });

export const iniciarAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { data: ag, error: e1 } = await supabase.from("agendamentos")
      .select("id, cliente_id, veiculo_id, servico_id, funcionario_id, ordem_id, observacoes, leva_traz, taxa_leva_traz")
      .eq("id", data.id).eq("owner_id", ownerId).single();
    if (e1) throw e1;
    if (ag.ordem_id) {
      return { ok: true, ordem_id: ag.ordem_id };
    }
    let valor = 0;
    if (ag.servico_id) {
      const { data: s } = await supabase.from("servicos").select("preco_padrao").eq("id", ag.servico_id).maybeSingle();
      valor = Number(s?.preco_padrao ?? 0);
    }
    valor += Number(ag.taxa_leva_traz ?? 0);
    // Se já tem funcionario no agendamento, usa; senão tenta o usuário logado (colaborador)
    let funcionario_id: string | null = ag.funcionario_id ?? null;
    if (!funcionario_id) {
      const { data: meFuncId } = await supabase.rpc("get_my_funcionario_id");
      if (meFuncId) funcionario_id = meFuncId as string;
    }
    const { data: os, error: e2 } = await supabase.from("ordens_servico").insert({
      owner_id: ownerId,
      cliente_id: ag.cliente_id,
      veiculo_id: ag.veiculo_id,
      servico_id: ag.servico_id,
      funcionario_id,
      valor,
      observacoes: ag.observacoes,
      status: "aguardando",
    }).select("id").single();
    if (e2) throw e2;
    const { error: e3 } = await supabase.from("agendamentos").update({
      status: "em_andamento",
      ordem_id: os.id,
      ...(ag.leva_traz ? { leva_traz_status: "em_servico" } : {}),
    }).eq("id", data.id).eq("owner_id", ownerId);
    if (e3) throw e3;
    return { ok: true, ordem_id: os.id };
  });


export const getAgendaConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const { data } = await context.supabase.from("agenda_config").select("*").eq("owner_id", ownerId).maybeSingle();
    return { config: data ?? { hora_inicio: "08:00", hora_fim: "18:00", dias_semana: [1,2,3,4,5,6], intervalo_min: 30, capacidade_simultanea: 1, permitir_escolha_profissional: false } };
  });

export const updateAgendaConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    hora_inicio: z.string().regex(/^\d{2}:\d{2}/),
    hora_fim: z.string().regex(/^\d{2}:\d{2}/),
    dias_semana: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    intervalo_min: z.number().int().refine(v => [15,30,60].includes(v)),
    capacidade_simultanea: z.number().int().min(1).max(10),
    permitir_escolha_profissional: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { ownerId } = await getOwnerScope(context.supabase, context.userId);
    const { error } = await context.supabase.from("agenda_config")
      .upsert({ ...data, owner_id: ownerId, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
    if (error) throw error;
    return { ok: true };
  });

// ===== PÚBLICAS (sem auth) =====
export const getEmpresaPublica = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin.rpc("get_empresa_by_slug", { _slug: data.slug });
    const empresa = (emp ?? [])[0];
    if (!empresa) throw new Error("Empresa não encontrada");
    const [{ data: servicos }, { data: cfg }, { data: recompensas }] = await Promise.all([
      supabaseAdmin.rpc("get_servicos_publicos", { _owner: empresa.owner_id }),
      supabaseAdmin.rpc("get_agenda_config_publica", { _owner: empresa.owner_id }),
      supabaseAdmin.from("recompensas").select("id, nome, custo_pontos, ativo").eq("owner_id", empresa.owner_id).eq("ativo", true).order("custo_pontos"),
    ]);
    await supabaseAdmin.from("public_page_events").insert({
      owner_id: empresa.owner_id,
      slug: data.slug,
      evento: "visualizacao",
      metadata: { origem: "pagina_publica" },
    } as any);
    return {
      empresa,
      servicos: servicos ?? [],
      recompensas: recompensas ?? [],
      config: (cfg ?? [])[0] ?? { hora_inicio: "08:00", hora_fim: "18:00", dias_semana: [1,2,3,4,5,6], intervalo_min: 30, capacidade_simultanea: 1 },
    };
  });

export const getClientePublico = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    slug: z.string().min(1).max(80),
    telefone: z.string().min(8).max(20),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin.rpc("get_empresa_by_slug", { _slug: data.slug });
    const empresa = (emp ?? [])[0];
    if (!empresa) throw new Error("Empresa nao encontrada");
    const owner_id = empresa.owner_id;
    const digits = data.telefone.replace(/\D/g, "");

    const { data: clientes } = await supabaseAdmin
      .from("clientes")
      .select("id, nome, telefone, whatsapp, pontos_saldo")
      .eq("owner_id", owner_id)
      .or(`telefone.ilike.%${digits}%,whatsapp.ilike.%${digits}%`)
      .limit(5);

    const cliente = (clientes ?? []).find((row: any) => {
      const tel = String(row.telefone ?? row.whatsapp ?? "").replace(/\D/g, "");
      return tel.endsWith(digits.slice(-8));
    }) ?? clientes?.[0];

    if (!cliente) return { cliente: null, agendamentos: [], historico: [], veiculos: [], recompensas: [], resgates: [], avaliacoes: [] };

    const [{ data: agendamentos }, { data: historico }, { data: veiculos }, { data: recompensas }, { data: movimentos }] = await Promise.all([
      supabaseAdmin.from("agendamentos")
        .select("id, data_agendada, hora_agendada, status, servicos:servico_id(nome)")
        .eq("owner_id", owner_id).eq("cliente_id", cliente.id)
        .gte("data_agendada", localDateIso())
        .order("data_agendada", { ascending: true })
        .order("hora_agendada", { ascending: true })
        .limit(5),
      supabaseAdmin.from("ordens_servico")
        .select("id, valor, status, created_at, servicos:servico_id(nome)")
        .eq("owner_id", owner_id).eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin.from("veiculos")
        .select("id, placa, marca, modelo, cor, vehicle_year")
        .eq("owner_id", owner_id).eq("cliente_id", cliente.id)
        .limit(5),
      supabaseAdmin.from("recompensas")
        .select("id, nome, custo_pontos, ativo")
        .eq("owner_id", owner_id).eq("ativo", true)
        .order("custo_pontos"),
      supabaseAdmin.from("pontos_movimentos")
        .select("id, pontos, tipo, criado_em")
        .eq("owner_id", owner_id).eq("cliente_id", cliente.id)
        .order("criado_em", { ascending: false })
        .limit(5),
    ]);

    const totalServicos = historico?.length ?? 0;
    const economiaEstimada = Math.round(Number(cliente.pontos_saldo ?? 0) * 0.5);

    return {
      cliente: { ...cliente, total_servicos: totalServicos, economia_estimada: economiaEstimada },
      agendamentos: agendamentos ?? [],
      historico: historico ?? [],
      veiculos: veiculos ?? [],
      recompensas: recompensas ?? [],
      resgates: (movimentos ?? []).filter((m: any) => m.tipo === "debito"),
      avaliacoes: [],
    };
  });

export const getHorariosDisponiveis = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; data: string; tz?: string }) => z.object({
    slug: z.string().min(1).max(80),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tz: z.string().max(60).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin.rpc("get_empresa_by_slug", { _slug: data.slug });
    const empresa = (emp ?? [])[0];
    if (!empresa) throw new Error("Empresa não encontrada");
    const [{ data: cfgRows }, { data: ocup }] = await Promise.all([
      supabaseAdmin.rpc("get_agenda_config_publica", { _owner: empresa.owner_id }),
      supabaseAdmin.rpc("get_ocupacao_dia", { _owner: empresa.owner_id, _data: data.data }),
    ]);
    const cfg = (cfgRows ?? [])[0] ?? { hora_inicio: "08:00", hora_fim: "18:00", dias_semana: [1,2,3,4,5,6], intervalo_min: 30, capacidade_simultanea: 1 };
    const tz = data.tz || "America/Sao_Paulo";

    // DST-safe: usa Intl com o fuso local da empresa para evitar off-by-one.
    const fmtParts = (d: Date) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
      }).formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      return { ymd: `${get("year")}-${get("month")}-${get("day")}`, hm: `${get("hour")}:${get("minute")}`, wd: get("weekday") };
    };
    const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dia = wdMap[fmtParts(new Date(data.data + "T12:00:00Z")).wd] ?? new Date(data.data + "T12:00:00").getDay();
    if (!cfg.dias_semana.includes(dia)) return { slots: [], timezone: tz, agora: null as string | null };

    const agora = fmtParts(new Date());
    const isHoje = agora.ymd === data.data;
    const [aH, aM] = agora.hm.split(":").map(Number);
    const agoraMin = (aH || 0) * 60 + (aM || 0) + 15; // 15min buffer

    const ocupMap = new Map<string, number>();
    (ocup ?? []).forEach((o: any) => ocupMap.set(o.hora_agendada.slice(0,5), Number(o.qtd)));
    const [hI, mI] = cfg.hora_inicio.split(":").map(Number);
    const [hF, mF] = cfg.hora_fim.split(":").map(Number);
    const slots: { hora: string; disponivel: boolean }[] = [];
    let mins = hI * 60 + mI;
    const fim = hF * 60 + mF;
    while (mins < fim) {
      const h = String(Math.floor(mins/60)).padStart(2,"0") + ":" + String(mins%60).padStart(2,"0");
      const usado = ocupMap.get(h) ?? 0;
      const passado = isHoje && mins < agoraMin;
      if (!passado) slots.push({ hora: h, disponivel: usado < cfg.capacidade_simultanea });
      mins += cfg.intervalo_min;
    }
    return { slots, timezone: tz, agora: isHoje ? agora.hm : null };
  });

export const solicitarAgendamentoPublico = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    slug: z.string().min(1).max(80),
    nome: z.string().min(2).max(120),
    telefone: z.string().min(8).max(20),
    veiculo: z.string().max(60).optional(),
    servico_id: z.string().uuid().nullable().optional(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hora: z.string().regex(/^\d{2}:\d{2}$/),
    observacoes: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin.rpc("get_empresa_by_slug", { _slug: data.slug });
    const empresa = (emp ?? [])[0];
    if (!empresa) throw new Error("Empresa não encontrada");
    const owner_id = empresa.owner_id;
    const hora = data.hora + ":00";

    // Verifica capacidade
    const { data: cfgRows } = await supabaseAdmin.rpc("get_agenda_config_publica", { _owner: owner_id });
    const cap = (cfgRows ?? [])[0]?.capacidade_simultanea ?? 1;
    const { count } = await supabaseAdmin.from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", owner_id)
      .eq("data_agendada", data.data)
      .eq("hora_agendada", hora)
      .not("status", "in", "(cancelado,nao_compareceu)");
    if ((count ?? 0) >= cap) throw new Error("Horário não está mais disponível.");

    // Upsert cliente por telefone
    const { data: existing } = await supabaseAdmin.from("clientes")
      .select("id").eq("owner_id", owner_id).eq("telefone", data.telefone).maybeSingle();
    let cliente_id = existing?.id;
    if (!cliente_id) {
      const { data: novo, error } = await supabaseAdmin.from("clientes").insert({
        owner_id, nome: data.nome, telefone: data.telefone, origem_cliente: "Agendamento online",
      }).select("id").single();
      if (error) throw error;
      cliente_id = novo.id;
    }

    const { error: e2 } = await supabaseAdmin.from("agendamentos").insert({
      owner_id, cliente_id, servico_id: data.servico_id ?? null,
      data_agendada: data.data, hora_agendada: hora,
      observacoes: data.veiculo ? `Veículo: ${data.veiculo}. ${data.observacoes ?? ""}`.trim() : data.observacoes ?? null,
      origem: "publico",
    });
    if (e2) throw e2;
    await supabaseAdmin.from("public_page_events").insert({
      owner_id,
      slug: data.slug,
      evento: "solicitacao_agendamento",
      metadata: { servico_id: data.servico_id ?? null, data: data.data, hora: data.hora },
    } as any);
    return { ok: true };
  });

// ============ FIDELIDADE — MENSAGENS INTELIGENTES ============

// Dados necessários para montar a mensagem de "veículo pronto" do programa de fidelidade.
export const getDadosMensagemPronto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ordemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { data: ordem, error } = await supabase
      .from("ordens_servico")
      .select(`id, valor, cliente_id,
        clientes:cliente_id(id, nome, telefone, pontos_saldo),
        veiculos:veiculo_id(placa),
        servicos:servico_id(nome)`)
      .eq("id", data.ordemId)
      .eq("owner_id", ownerId)
      .single();
    if (error) throw error;
    const cliente: any = ordem.clientes;

    const [{ data: cfg }, { data: recompensas }, { data: visitasRows }] = await Promise.all([
      supabase.from("fidelidade_config").select("pontos_por_lavagem, pontos_por_real").eq("owner_id", ownerId).maybeSingle(),
      supabase.from("recompensas").select("id, nome, custo_pontos, ativo").eq("owner_id", ownerId).eq("ativo", true).order("custo_pontos"),
      supabase.from("ordens_servico").select("id", { count: "exact", head: false }).eq("owner_id", ownerId).eq("cliente_id", cliente?.id),
    ]);

    return {
      cliente: {
        id: cliente?.id,
        nome: cliente?.nome ?? "Cliente",
        telefone: cliente?.telefone ?? null,
        pontos_saldo: Number(cliente?.pontos_saldo ?? 0),
        total_visitas: visitasRows?.length ?? 0,
      },
      ordem: {
        id: ordem.id,
        valor: Number(ordem.valor ?? 0),
        servico_nome: (ordem.servicos as any)?.nome ?? null,
        placa: (ordem.veiculos as any)?.placa ?? null,
      },
      config: {
        pontos_por_lavagem: Number(cfg?.pontos_por_lavagem ?? 10),
        pontos_por_real: Number(cfg?.pontos_por_real ?? 1),
      },
      recompensas: recompensas ?? [],
    };
  });

export const getExtratoFidelidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clienteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const [{ data: cliente }, { data: movs }, { data: recompensas }] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, pontos_saldo").eq("id", data.clienteId).eq("owner_id", ownerId).single(),
      supabase.from("pontos_movimentos")
        .select("pontos, tipo, created_at, ordem_id, ordens_servico:ordem_id(servicos:servico_id(nome))")
        .eq("owner_id", ownerId).eq("cliente_id", data.clienteId)
        .order("created_at", { ascending: false }).limit(10),
      supabase.from("recompensas").select("id, nome, custo_pontos, ativo").eq("owner_id", ownerId).eq("ativo", true).order("custo_pontos"),
    ]);

    const movimentos = (movs ?? []).map((m: any) => ({
      pontos: m.tipo === "credito" ? Number(m.pontos) : -Number(m.pontos),
      servico_nome: m.ordens_servico?.servicos?.nome ?? null,
      created_at: m.created_at,
    }));

    return { cliente, movimentos, recompensas: recompensas ?? [] };
  });

export const getClientesComRecompensa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const [{ data: recompensas }, { data: clientes }, { data: ordens }] = await Promise.all([
      supabase.from("recompensas").select("id, nome, custo_pontos").eq("owner_id", ownerId).eq("ativo", true).order("custo_pontos"),
      supabase.from("clientes").select("id, nome, telefone, pontos_saldo").eq("owner_id", ownerId),
      supabase.from("ordens_servico").select("valor").eq("owner_id", ownerId).gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString()),
    ]);
    const ativas = (recompensas ?? []).sort((a, b) => a.custo_pontos - b.custo_pontos);
    if (ativas.length === 0) return { qtd: 0, clientes: [], proximos: [], ticketMedio: 0 };
    const minCusto = ativas[0].custo_pontos;
    const elegiveis = (clientes ?? []).filter((c) => Number(c.pontos_saldo ?? 0) >= minCusto)
      .map((c) => {
        const saldo = Number(c.pontos_saldo ?? 0);
        const disp = ativas.filter((r) => r.custo_pontos <= saldo);
        const melhor = disp[disp.length - 1];
        return { ...c, recompensa: melhor?.nome ?? null };
      });
    const proximos = (clientes ?? []).filter((c) => {
      const saldo = Number(c.pontos_saldo ?? 0);
      return saldo < minCusto && (minCusto - saldo) <= 50;
    }).map((c) => ({ ...c, faltam: minCusto - Number(c.pontos_saldo ?? 0) }));

    const totalReceita = (ordens ?? []).reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const ticketMedio = (ordens && ordens.length > 0) ? totalReceita / ordens.length : 50;

    return { qtd: elegiveis.length, clientes: elegiveis, proximos, ticketMedio };
  });

// ============ CRESCIMENTO — KPIs e Impacto do Mês ============
export const getCrescimentoKPIs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const now = Date.now();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const [{ data: clientes }, { data: ordens }, { data: assinaturas }, { data: planos }, { data: recompensas }] = await Promise.all([
      supabase.from("clientes").select("id, pontos_saldo").eq("owner_id", ownerId),
      supabase.from("ordens_servico").select("cliente_id, valor, created_at").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(2000),
      supabase.from("assinaturas_clientes").select("cliente_id, status").eq("owner_id", ownerId),
      supabase.from("planos_assinatura").select("valor_mensal").eq("owner_id", ownerId).eq("ativo", true).order("valor_mensal", { ascending: true }).limit(1),
      supabase.from("recompensas").select("custo_pontos").eq("owner_id", ownerId).eq("ativo", true).order("custo_pontos", { ascending: true }).limit(1),
    ]);

    type OS = { cliente_id: string; valor: number; created_at: string };
    const all = (ordens ?? []) as OS[];
    const byCliente = new Map<string, OS[]>();
    all.forEach((o) => {
      const arr = byCliente.get(o.cliente_id) ?? [];
      arr.push(o);
      byCliente.set(o.cliente_id, arr);
    });

    let receitaRecuperavel = 0;
    let clientesEmRisco = 0;
    let candidatosAssinatura = 0;
    let recuperadosNoMes = 0;
    let faturamentoRecuperado = 0;

    const assinaturasAtivas = new Set(
      (assinaturas ?? []).filter((a) => a.status === "ativa").map((a) => a.cliente_id),
    );

    for (const [cid, list] of byCliente) {
      const sorted = list.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      const ultima = new Date(sorted[sorted.length - 1].created_at).getTime();
      const dias = Math.floor((now - ultima) / 86_400_000);
      const ticket = list.reduce((s, o) => s + Number(o.valor ?? 0), 0) / list.length;

      if (list.length >= 3 && dias >= 45 && dias <= 90) {
        clientesEmRisco += 1;
        receitaRecuperavel += ticket;
      }

      const sixtyAgo = now - 60 * 86_400_000;
      const recentes60 = list.filter((o) => new Date(o.created_at).getTime() >= sixtyAgo).length;
      if (recentes60 >= 4 && !assinaturasAtivas.has(cid)) candidatosAssinatura += 1;

      const visitasMes = sorted.filter((o) => new Date(o.created_at).getTime() >= startOfMonth);
      const anterior = sorted.filter((o) => new Date(o.created_at).getTime() < startOfMonth).pop();
      if (visitasMes.length > 0 && anterior) {
        const gap = (new Date(visitasMes[0].created_at).getTime() - new Date(anterior.created_at).getTime()) / 86_400_000;
        if (gap >= 30) {
          recuperadosNoMes += 1;
          faturamentoRecuperado += visitasMes.reduce((s, o) => s + Number(o.valor ?? 0), 0);
        }
      }
    }

    const minCusto = recompensas?.[0]?.custo_pontos ?? null;
    const proximasRecompensas = minCusto != null
      ? (clientes ?? []).filter((c) => {
          const s = Number(c.pontos_saldo ?? 0);
          return s < minCusto && minCusto - s <= 50;
        }).length
      : 0;

    const valorPlanoBase = Number(planos?.[0]?.valor_mensal ?? 0);
    const potencialAssinatura = candidatosAssinatura * valorPlanoBase;

    return {
      receitaRecuperavel: Math.round(receitaRecuperavel * 100) / 100,
      clientesEmRisco,
      proximasRecompensas,
      potencialAssinatura: Math.round(potencialAssinatura * 100) / 100,
      candidatosAssinatura,
      impactoMes: {
        clientesRecuperados: recuperadosNoMes,
        faturamentoRecuperado: Math.round(faturamentoRecuperado * 100) / 100,
      },
    };
  });
