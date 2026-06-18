import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ DASHBOARD METRICS ============
export const getDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [{ data: ordensMes }, { data: ordensLast }, { data: assinaturas }, { data: clientes }, { data: ordensAll }] = await Promise.all([
      supabase.from("ordens_servico").select("id, valor, cliente_id, status, created_at, entregue_em").gte("created_at", startOfMonth).eq("owner_id", userId),
      supabase.from("ordens_servico").select("id, valor, cliente_id").gte("created_at", startOfLastMonth).lte("created_at", endOfLastMonth).eq("owner_id", userId),
      supabase.from("assinaturas_clientes").select("id, plano_id, status, planos_assinatura:plano_id(valor_mensal)").eq("owner_id", userId).eq("status", "ativa"),
      supabase.from("clientes").select("id, pontos_saldo, created_at").eq("owner_id", userId),
      supabase.from("ordens_servico").select("cliente_id, created_at, valor, servico_id").gte("created_at", ninetyDaysAgo).eq("owner_id", userId),
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

// ============ OPORTUNIDADES ============
export const getOportunidades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();

    const [{ data: clientes }, { data: ordens }] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, pontos_saldo, created_at").eq("owner_id", userId),
      supabase.from("ordens_servico").select("id, cliente_id, valor, created_at").gte("created_at", ninetyAgo).eq("owner_id", userId).order("created_at", { ascending: false }),
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
    const sixtyAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const { data: ordens } = await supabase
      .from("ordens_servico")
      .select("id, valor, created_at, cliente_id, servico_id")
      .gte("created_at", sixtyAgo)
      .eq("owner_id", userId);

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

export const getFila = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`
        id, status, posicao, valor, created_at, iniciado_em, finalizado_em, entregue_em,
        observacoes, cliente_id, veiculo_id, servico_id, funcionario_id,
        clientes:cliente_id(nome, telefone),
        veiculos:veiculo_id(placa, modelo, cor),
        servicos:servico_id(nome),
        funcionarios:funcionario_id(nome)
      `)
      .eq("owner_id", userId)
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
    const patch: any = { status: data.status };
    if (data.status === "em_lavagem") patch.iniciado_em = new Date().toISOString();
    if (data.status === "pronto") patch.finalizado_em = new Date().toISOString();
    if (data.status === "entregue") patch.entregue_em = new Date().toISOString();
    const { error } = await supabase.from("ordens_servico").update(patch).eq("id", data.id).eq("owner_id", userId);
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
    const { error } = await supabase.from("interacoes_clientes").insert({
      owner_id: userId,
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
    const { data, error } = await supabase
      .from("interacoes_clientes")
      .select("id, descricao, created_at, cliente_id, clientes:cliente_id(nome)")
      .eq("owner_id", userId)
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
    const { error, data: row } = await supabase.from("ordens_servico").insert({ ...data, owner_id: userId, status: "aguardando" }).select().single();
    if (error) throw error;
    return { ordem: row };
  });

export const listOrdens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`id, status, valor, created_at, clientes:cliente_id(nome), veiculos:veiculo_id(placa), servicos:servico_id(nome), funcionarios:funcionario_id(nome)`)
      .eq("owner_id", userId).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return { ordens: data ?? [] };
  });

// ============ CLIENTES ============
export const listClientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [{ data: clientes }, { data: ordens }] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, pontos_saldo, created_at").eq("owner_id", userId).order("nome"),
      supabase.from("ordens_servico").select("cliente_id, created_at, valor").eq("owner_id", userId).gte("created_at", ninetyAgo),
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
    const { data: clientes } = await supabase.from("clientes").select("id, nome, telefone, pontos_saldo").eq("owner_id", userId);
    const { data: ordens } = await supabase.from("ordens_servico").select("cliente_id, created_at").eq("owner_id", userId);
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

export const createCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    nome: z.string().min(1).max(120),
    telefone: z.string().max(20).optional().nullable(),
    origem_cliente: z.string().max(50).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("clientes").insert({ ...data, owner_id: userId }).select().single();
    if (error) throw error;
    return { cliente: row };
  });

export const getClienteDetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: cliente }, { data: veiculos }, { data: ordens }, { data: interacoes }] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", data.id).eq("owner_id", userId).single(),
      supabase.from("veiculos").select("*").eq("cliente_id", data.id).eq("owner_id", userId),
      supabase.from("ordens_servico").select("id, valor, status, created_at, servicos:servico_id(nome)").eq("cliente_id", data.id).eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("interacoes_clientes").select("*").eq("cliente_id", data.id).eq("owner_id", userId).order("created_at", { ascending: false }).limit(30),
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
    modelo: z.string().max(60).optional().nullable(),
    cor: z.string().max(30).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("veiculos").insert({ ...data, owner_id: userId });
    if (error) throw error;
    return { ok: true };
  });

// ============ SERVIÇOS ============
export const listServicos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("servicos").select("*").eq("owner_id", context.userId).order("nome");
    return { servicos: data ?? [] };
  });

export const upsertServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1).max(80),
    preco_padrao: z.number().min(0),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row = { ...data, owner_id: context.userId };
    const { error } = data.id
      ? await context.supabase.from("servicos").update(row).eq("id", data.id).eq("owner_id", context.userId)
      : await context.supabase.from("servicos").insert(row);
    if (error) throw error;
    return { ok: true };
  });

// ============ EQUIPE ============
export const listFuncionarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ninetyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [{ data: func }, { data: ordens }] = await Promise.all([
      context.supabase.from("funcionarios").select("*").eq("owner_id", context.userId).order("nome"),
      context.supabase.from("ordens_servico").select("funcionario_id, valor").eq("owner_id", context.userId).gte("created_at", ninetyAgo).eq("status", "entregue"),
    ]);
    const stats = new Map<string, { count: number; total: number }>();
    (ordens ?? []).forEach((o) => {
      if (!o.funcionario_id) return;
      const cur = stats.get(o.funcionario_id) ?? { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(o.valor ?? 0);
      stats.set(o.funcionario_id, cur);
    });
    return {
      funcionarios: (func ?? []).map((f) => ({ ...f, lavagens_mes: stats.get(f.id)?.count ?? 0, receita_mes: stats.get(f.id)?.total ?? 0 })),
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
    const row = { ...data, owner_id: context.userId };
    const { error } = data.id
      ? await context.supabase.from("funcionarios").update(row).eq("id", data.id).eq("owner_id", context.userId)
      : await context.supabase.from("funcionarios").insert(row);
    if (error) throw error;
    return { ok: true };
  });

// ============ ASSINATURAS ============
export const getAssinaturas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: planos }, { data: todas }, { data: emp }] = await Promise.all([
      context.supabase.from("planos_assinatura").select("*").eq("owner_id", context.userId).order("valor_mensal"),
      context.supabase.from("assinaturas_clientes").select("*, clientes:cliente_id(nome, telefone), planos_assinatura:plano_id(nome, valor_mensal)").eq("owner_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("empresa").select("slug").eq("owner_id", context.userId).maybeSingle(),
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
    const row: any = { ...data, owner_id: context.userId };
    if (!data.id) {
      const base = slugifyPlano(data.nome) || "plano";
      row.slug = `${base}-${context.userId.slice(0, 6)}`;
    }
    const { error } = data.id
      ? await context.supabase.from("planos_assinatura").update(row).eq("id", data.id).eq("owner_id", context.userId)
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
    const proxima = new Date(); proxima.setDate(proxima.getDate() + 30);
    const { error } = await context.supabase.from("assinaturas_clientes").update({
      status: "ativa" as any,
      pago_em: new Date().toISOString(),
      proxima_cobranca: proxima.toISOString().slice(0, 10),
      lavagens_usadas_mes: 0,
      gateway_ref: data.gateway_ref ?? null,
    }).eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const cancelarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("assinaturas_clientes")
      .update({ status: "cancelada" as any })
      .eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ============ FIDELIDADE ============
export const getFidelidade = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: cfg }, { data: recompensas }, { data: top }] = await Promise.all([
      context.supabase.from("fidelidade_config").select("*").eq("owner_id", context.userId).maybeSingle(),
      context.supabase.from("recompensas").select("*").eq("owner_id", context.userId).order("custo_pontos"),
      context.supabase.from("clientes").select("id, nome, pontos_saldo").eq("owner_id", context.userId).order("pontos_saldo", { ascending: false }).limit(10),
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
    const { error } = await context.supabase.from("fidelidade_config").upsert({ ...data, owner_id: context.userId }, { onConflict: "owner_id" });
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
    const row = { ...data, owner_id: context.userId };
    const { error } = data.id
      ? await context.supabase.from("recompensas").update(row).eq("id", data.id).eq("owner_id", context.userId)
      : await context.supabase.from("recompensas").insert(row);
    if (error) throw error;
    return { ok: true };
  });

// ============ EMPRESA / CONFIGURAÇÕES ============
export const getEmpresa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("empresa").select("*").eq("owner_id", context.userId).maybeSingle();
    return { empresa: data };
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
    const { error } = await context.supabase.from("empresa").upsert({ ...data, owner_id: context.userId }, { onConflict: "owner_id" });
    if (error) throw error;
    return { ok: true };
  });

// ============ RELATÓRIOS ============
export const getRelatorios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data: ordens } = await context.supabase
      .from("ordens_servico")
      .select("valor, created_at, status, servicos:servico_id(nome), funcionarios:funcionario_id(nome)")
      .eq("owner_id", context.userId).gte("created_at", ninetyAgo);

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

// ============ COLABORADORES / MEU TRABALHO ============
async function getOwnerScope(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("owner_id, role").eq("user_id", userId);
  const colab = (data ?? []).find((r: any) => r.role === "colaborador");
  const isOwner = (data ?? []).some((r: any) => r.role === "owner");
  return { ownerId: colab?.owner_id ?? userId, role: colab && !isOwner ? "colaborador" : "owner" as "owner" | "colaborador" };
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
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("vincular_colaborador", {
      _funcionario_id: data.funcionario_id,
      _email: data.email,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertFuncionarioFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1).max(80),
    cargo: z.string().max(40).optional().nullable(),
    telefone: z.string().max(20).optional().nullable(),
    email: z.string().email().max(160).optional().nullable().or(z.literal("")),
    comissao_tipo: z.enum(["fixo", "percentual"]).default("fixo"),
    comissao_valor: z.number().min(0).max(10000).default(0),
    comissao_modo: z.enum(["global", "por_servico"]).default("global"),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row: any = { ...data, owner_id: context.userId };
    if (row.email === "") row.email = null;
    const { error } = data.id
      ? await context.supabase.from("funcionarios").update(row).eq("id", data.id).eq("owner_id", context.userId)
      : await context.supabase.from("funcionarios").insert(row);
    if (error) throw error;
    return { ok: true };
  });

// ============ COMISSÕES POR SERVIÇO ============
export const listComissoesServico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { funcionario_id: string }) => z.object({ funcionario_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("comissoes_servico")
      .select("id, servico_id, tipo, valor")
      .eq("owner_id", context.userId)
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
    const { error: delErr } = await supabase.from("comissoes_servico")
      .delete().eq("owner_id", userId).eq("funcionario_id", data.funcionario_id);
    if (delErr) throw delErr;
    const rows = data.itens
      .filter((i) => i.valor > 0)
      .map((i) => ({ ...i, owner_id: userId, funcionario_id: data.funcionario_id }));
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

export const getEquipePainel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    periodo: z.enum(["semana", "quinzena", "mes", "custom"]).default("mes"),
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { start, end } = rangeForPeriodo(data.periodo, data.inicio, data.fim);
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);

    const [{ data: func }, { data: ordens }, { data: comissoes }, { data: pagamentos }] = await Promise.all([
      supabase.from("funcionarios")
        .select("id, nome, ativo, comissao_tipo, comissao_valor, comissao_modo, auth_user_id, cargo, telefone, email")
        .eq("owner_id", userId).order("nome"),
      supabase.from("ordens_servico")
        .select("id, valor, status, funcionario_id, iniciado_em, entregue_em, created_at")
        .eq("owner_id", userId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase.from("comissoes")
        .select("funcionario_id, valor, pagamento_id, created_at")
        .eq("owner_id", userId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      supabase.from("pagamentos_comissao")
        .select("funcionario_id, valor, pago_em")
        .eq("owner_id", userId)
        .order("pago_em", { ascending: false }),
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
        ativo: f.ativo, vinculado: !!f.auth_user_id,
        comissao_tipo: f.comissao_tipo, comissao_valor: Number(f.comissao_valor),
        comissao_modo: f.comissao_modo,
        tipo_label: tipoLabel,
        lavagens: m.lavagens, receita: m.receita,
        comissao_acumulada: m.comissaoAberta,
        comissao_total: m.comissaoTotal,
        status,
        ultimo_pagamento: ultimoPagto.get(f.id) ?? null,
      };
    });

    const totalAPagar = colaboradores.reduce((s, c) => s + c.comissao_acumulada, 0);
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
    const inicioIso = new Date(data.periodo_inicio + "T00:00:00").toISOString();
    const fimIso = new Date(data.periodo_fim + "T23:59:59").toISOString();
    const { data: abertas, error: eList } = await supabase
      .from("comissoes")
      .select("id, valor")
      .eq("owner_id", userId)
      .eq("funcionario_id", data.funcionario_id)
      .is("pagamento_id", null)
      .gte("created_at", inicioIso)
      .lte("created_at", fimIso);
    if (eList) throw eList;
    const valor = (abertas ?? []).reduce((s, c) => s + Number(c.valor ?? 0), 0);
    if (valor <= 0) throw new Error("Nada a pagar no período selecionado.");
    const { data: pag, error: ePag } = await supabase.from("pagamentos_comissao").insert({
      owner_id: userId, funcionario_id: data.funcionario_id,
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
    return { ok: true, valor };
  });

export const listPagamentosComissao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ funcionario_id: z.string().uuid(), limit: z.number().int().min(1).max(50).default(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("pagamentos_comissao")
      .select("id, valor, pago_em, periodo_inicio, periodo_fim, observacao")
      .eq("owner_id", context.userId)
      .eq("funcionario_id", data.funcionario_id)
      .order("pago_em", { ascending: false })
      .limit(data.limit);
    return { pagamentos: rows ?? [] };
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
    }).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: any = {
      nome: data.nome.trim(),
      telefone: data.telefone || null,
      whatsapp: data.whatsapp || null,
      email: (data.email && data.email !== "") ? data.email : null,
      observacoes: data.observacoes || null,
    };
    const { error: eC } = await supabase.from("clientes")
      .update(patch).eq("id", data.id).eq("owner_id", userId);
    if (eC) throw eC;
    if (data.veiculo) {
      const v = {
        placa: data.veiculo.placa.toUpperCase().trim(),
        modelo: data.veiculo.modelo || null,
        marca: data.veiculo.marca || null,
        cor: data.veiculo.cor || null,
      };
      if (data.veiculo.id) {
        const { error } = await supabase.from("veiculos")
          .update(v).eq("id", data.veiculo.id).eq("owner_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("veiculos").insert({
          ...v, owner_id: userId, cliente_id: data.id,
        });
        if (error) throw error;
      }
    }
    return { ok: true };
  });

export const getMeuTrabalho = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getOwnerScope(supabase, userId);
    const { data: meFunc } = await supabase
      .from("funcionarios")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const startToday = new Date(); startToday.setHours(0,0,0,0);
    const startWeek = new Date(); startWeek.setDate(startWeek.getDate() - 7);
    const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);

    const [{ data: ordens }, { data: comissoesMes }] = await Promise.all([
      supabase
        .from("ordens_servico")
        .select(`id, status, valor, created_at, iniciado_em, finalizado_em, entregue_em, funcionario_id,
                 clientes:cliente_id(nome, telefone), veiculos:veiculo_id(placa, modelo), servicos:servico_id(nome)`)
        .eq("owner_id", ownerId)
        .in("status", ["aguardando", "em_lavagem"])
        .order("created_at", { ascending: true }),
      meFunc?.id
        ? supabase.from("comissoes").select("valor, created_at").eq("funcionario_id", meFunc.id).gte("created_at", startMonth.toISOString())
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // Métricas próprias
    const { data: minhasOs } = meFunc?.id
      ? await supabase
          .from("ordens_servico")
          .select("status, valor, iniciado_em, finalizado_em, entregue_em, created_at")
          .eq("funcionario_id", meFunc.id)
          .gte("created_at", startWeek.toISOString())
      : { data: [] as any[] };

    const hoje = (minhasOs ?? []).filter(o => o.entregue_em && new Date(o.entregue_em) >= startToday);
    const semana = (minhasOs ?? []).filter(o => o.entregue_em);
    const tempos = (minhasOs ?? [])
      .filter(o => o.iniciado_em && o.finalizado_em)
      .map(o => (new Date(o.finalizado_em!).getTime() - new Date(o.iniciado_em!).getTime()) / 60000);
    const tempoMedio = tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : 0;
    const comissaoMes = (comissoesMes ?? []).reduce((s: number, c: any) => s + Number(c.valor ?? 0), 0);

    return {
      funcionario: meFunc,
      cards: {
        concluidasHoje: hoje.length,
        tempoMedioMin: tempoMedio,
        comissaoMes,
        lavagensSemana: semana.length,
      },
      fila: ordens ?? [],
    };
  });

export const iniciarOs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: meFunc } = await supabase.from("funcionarios").select("id").eq("auth_user_id", userId).maybeSingle();
    const patch: any = { status: "em_lavagem", iniciado_em: new Date().toISOString() };
    if (meFunc?.id) patch.funcionario_id = meFunc.id;
    const { error } = await supabase.from("ordens_servico").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const finalizarOs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ordens_servico")
      .update({ status: "pronto", finalizado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getEquipeMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { periodo: "hoje" | "semana" | "mes" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const start = new Date();
    if (data.periodo === "hoje") start.setHours(0, 0, 0, 0);
    else if (data.periodo === "semana") start.setDate(now.getDate() - 7);
    else { start.setDate(1); start.setHours(0, 0, 0, 0); }
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);

    const [{ data: ordens }, { data: func }, { data: comissoes }] = await Promise.all([
      supabase.from("ordens_servico")
        .select("id, valor, status, funcionario_id, iniciado_em, finalizado_em, entregue_em, created_at")
        .eq("owner_id", userId)
        .gte("created_at", start.toISOString()),
      supabase.from("funcionarios").select("id, nome, ativo").eq("owner_id", userId),
      supabase.from("comissoes").select("funcionario_id, valor, created_at").eq("owner_id", userId).gte("created_at", start.toISOString()),
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

    const ranking = (func ?? []).map(f => ({ id: f.id, nome: f.nome, ...byFunc.get(f.id)! }))
      .sort((a, b) => b.lavagens - a.lavagens);

    return {
      cards: { lavadosHoje, colabAtivosHoje, tempoMedio, valorEquipe },
      ranking,
    };
  });

// ============ AGENDAMENTOS ============
export type AgendamentoStatus = "agendado" | "confirmado" | "em_andamento" | "concluido" | "cancelado" | "nao_compareceu";

export const listAgendamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { date?: string; from?: string; to?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("agendamentos")
      .select(`id, data_agendada, hora_agendada, status, observacoes, ordem_id, created_at,
               cliente_id, veiculo_id, servico_id, funcionario_id,
               clientes:cliente_id(nome, telefone),
               veiculos:veiculo_id(placa, modelo),
               servicos:servico_id(nome, preco_padrao),
               funcionarios:funcionario_id(nome)`)
      .eq("owner_id", userId)
      .order("data_agendada", { ascending: true })
      .order("hora_agendada", { ascending: true });
    if (data.date) q = q.eq("data_agendada", data.date);
    if (data.from) q = q.gte("data_agendada", data.from);
    if (data.to) q = q.lte("data_agendada", data.to);
    const { data: rows, error } = await q.limit(500);
    if (error) throw error;
    return { agendamentos: rows ?? [] };
  });

export const agendamentoStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const [{ data: hoje }, { data: mes }] = await Promise.all([
      supabase.from("agendamentos").select("id, status").eq("owner_id", userId).eq("data_agendada", today),
      supabase.from("agendamentos").select("id, status").eq("owner_id", userId).gte("data_agendada", monthAgo),
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
      totalMes,
    };
  });

export const createAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    cliente_id: z.string().uuid(),
    veiculo_id: z.string().uuid().nullable().optional(),
    servico_id: z.string().uuid().nullable().optional(),
    data_agendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hora_agendada: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    observacoes: z.string().max(500).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hora = data.hora_agendada.length === 5 ? data.hora_agendada + ":00" : data.hora_agendada;
    // Valida capacidade
    const { data: cfg } = await supabase.from("agenda_config").select("capacidade_simultanea").eq("owner_id", userId).maybeSingle();
    const cap = cfg?.capacidade_simultanea ?? 1;
    const { count } = await supabase.from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("data_agendada", data.data_agendada)
      .eq("hora_agendada", hora)
      .not("status", "in", "(cancelado,nao_compareceu)");
    if ((count ?? 0) >= cap) {
      throw new Error(`Horário lotado (capacidade ${cap}).`);
    }
    const { error, data: row } = await supabase.from("agendamentos").insert({
      ...data, hora_agendada: hora, owner_id: userId,
    }).select().single();
    if (error) throw error;
    return { agendamento: row };
  });

export const updateAgendamentoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    status: z.enum(["agendado","confirmado","em_andamento","concluido","cancelado","nao_compareceu"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: any = { status: data.status };
    if (data.status === "confirmado") patch.confirmado_em = new Date().toISOString();
    if (data.status === "cancelado") patch.cancelado_em = new Date().toISOString();
    if (data.status === "concluido") patch.concluido_em = new Date().toISOString();
    const { error } = await supabase.from("agendamentos").update(patch).eq("id", data.id).eq("owner_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const iniciarAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ag, error: e1 } = await supabase.from("agendamentos")
      .select("id, cliente_id, veiculo_id, servico_id, ordem_id, observacoes")
      .eq("id", data.id).eq("owner_id", userId).single();
    if (e1) throw e1;
    if (ag.ordem_id) {
      return { ok: true, ordem_id: ag.ordem_id };
    }
    let valor = 0;
    if (ag.servico_id) {
      const { data: s } = await supabase.from("servicos").select("preco_padrao").eq("id", ag.servico_id).maybeSingle();
      valor = Number(s?.preco_padrao ?? 0);
    }
    const { data: os, error: e2 } = await supabase.from("ordens_servico").insert({
      owner_id: userId,
      cliente_id: ag.cliente_id,
      veiculo_id: ag.veiculo_id,
      servico_id: ag.servico_id,
      valor,
      observacoes: ag.observacoes,
      status: "aguardando",
    }).select("id").single();
    if (e2) throw e2;
    const { error: e3 } = await supabase.from("agendamentos").update({
      status: "em_andamento",
      ordem_id: os.id,
    }).eq("id", data.id).eq("owner_id", userId);
    if (e3) throw e3;
    return { ok: true, ordem_id: os.id };
  });

export const getAgendaConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("agenda_config").select("*").eq("owner_id", context.userId).maybeSingle();
    return { config: data ?? { hora_inicio: "08:00", hora_fim: "18:00", dias_semana: [1,2,3,4,5,6], intervalo_min: 30, capacidade_simultanea: 1 } };
  });

export const updateAgendaConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    hora_inicio: z.string().regex(/^\d{2}:\d{2}/),
    hora_fim: z.string().regex(/^\d{2}:\d{2}/),
    dias_semana: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    intervalo_min: z.number().int().refine(v => [15,30,60].includes(v)),
    capacidade_simultanea: z.number().int().min(1).max(10),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agenda_config")
      .upsert({ ...data, owner_id: context.userId, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
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
    const [{ data: servicos }, { data: cfg }] = await Promise.all([
      supabaseAdmin.rpc("get_servicos_publicos", { _owner: empresa.owner_id }),
      supabaseAdmin.rpc("get_agenda_config_publica", { _owner: empresa.owner_id }),
    ]);
    return {
      empresa,
      servicos: servicos ?? [],
      config: (cfg ?? [])[0] ?? { hora_inicio: "08:00", hora_fim: "18:00", dias_semana: [1,2,3,4,5,6], intervalo_min: 30, capacidade_simultanea: 1 },
    };
  });

export const getHorariosDisponiveis = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; data: string }) => z.object({
    slug: z.string().min(1).max(80),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    const dia = new Date(data.data + "T12:00:00").getDay();
    if (!cfg.dias_semana.includes(dia)) return { slots: [] };
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
      slots.push({ hora: h, disponivel: usado < cfg.capacidade_simultanea });
      mins += cfg.intervalo_min;
    }
    return { slots };
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
    return { ok: true };
  });

// ============ FIDELIDADE — MENSAGENS INTELIGENTES ============

// Dados necessários para montar a mensagem de "veículo pronto" do programa de fidelidade.
export const getDadosMensagemPronto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ordemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ordem, error } = await supabase
      .from("ordens_servico")
      .select(`id, valor, cliente_id,
        clientes:cliente_id(id, nome, telefone, pontos_saldo),
        veiculos:veiculo_id(placa),
        servicos:servico_id(nome)`)
      .eq("id", data.ordemId)
      .eq("owner_id", userId)
      .single();
    if (error) throw error;
    const cliente: any = ordem.clientes;

    const [{ data: cfg }, { data: recompensas }, { data: visitasRows }] = await Promise.all([
      supabase.from("fidelidade_config").select("pontos_por_lavagem, pontos_por_real").eq("owner_id", userId).maybeSingle(),
      supabase.from("recompensas").select("id, nome, custo_pontos, ativo").eq("owner_id", userId).eq("ativo", true).order("custo_pontos"),
      supabase.from("ordens_servico").select("id", { count: "exact", head: false }).eq("owner_id", userId).eq("cliente_id", cliente?.id),
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
    const [{ data: cliente }, { data: movs }, { data: recompensas }] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, pontos_saldo").eq("id", data.clienteId).eq("owner_id", userId).single(),
      supabase.from("pontos_movimentos")
        .select("pontos, tipo, created_at, ordem_id, ordens_servico:ordem_id(servicos:servico_id(nome))")
        .eq("owner_id", userId).eq("cliente_id", data.clienteId)
        .order("created_at", { ascending: false }).limit(10),
      supabase.from("recompensas").select("id, nome, custo_pontos, ativo").eq("owner_id", userId).eq("ativo", true).order("custo_pontos"),
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
    const [{ data: recompensas }, { data: clientes }, { data: ordens }] = await Promise.all([
      supabase.from("recompensas").select("id, nome, custo_pontos").eq("owner_id", userId).eq("ativo", true).order("custo_pontos"),
      supabase.from("clientes").select("id, nome, telefone, pontos_saldo").eq("owner_id", userId),
      supabase.from("ordens_servico").select("valor").eq("owner_id", userId).gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString()),
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
    const now = Date.now();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const [{ data: clientes }, { data: ordens }, { data: assinaturas }, { data: planos }, { data: recompensas }] = await Promise.all([
      supabase.from("clientes").select("id, pontos_saldo").eq("owner_id", userId),
      supabase.from("ordens_servico").select("cliente_id, valor, created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(2000),
      supabase.from("assinaturas_clientes").select("cliente_id, status").eq("owner_id", userId),
      supabase.from("planos_assinatura").select("valor_mensal").eq("owner_id", userId).eq("ativo", true).order("valor_mensal", { ascending: true }).limit(1),
      supabase.from("recompensas").select("custo_pontos").eq("owner_id", userId).eq("ativo", true).order("custo_pontos", { ascending: true }).limit(1),
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


