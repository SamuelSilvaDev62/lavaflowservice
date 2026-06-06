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

    return {
      faturamentoMes, faturamentoLast, crescimento, mrr, assinantes,
      lavagensMes, ticketMedio, retencao, totalClientes, inativos,
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

    const oportunidades: Array<{
      id: string; tipo: string; prioridade: number; titulo: string; descricao: string;
      cliente_id: string; cliente_nome: string; telefone: string | null; receitaPotencial: number;
    }> = [];

    (clientes ?? []).forEach((c) => {
      const last = lastByCliente.get(c.id);
      if (!last) return;
      const days = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
      const ticketMedio = 50;
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
    const melhor = porDia.indexOf(Math.max(...porDia));
    const pior = porDia.indexOf(Math.min(...porDia.filter((v) => v > 0)));
    insights.push({ id: "best-day", tipo: "positivo", titulo: `Seu melhor dia é ${labels[melhor]}`, descricao: `Concentre promoções em ${labels[melhor]} para crescer ainda mais.` });
    if (pior >= 0 && porDia[pior] < porDia[melhor] * 0.4) {
      insights.push({ id: "weak-day", tipo: "alerta", titulo: `${labels[pior]} está fraco`, descricao: "Considere descontos ou pacotes para movimentar esse dia.", acao: "Criar campanha" });
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
      .in("status", ["aguardando", "em_andamento", "pronto", "entregue"])
      .order("posicao", { ascending: true });
    if (error) throw error;
    return { ordens: data ?? [] };
  });

export const updateOrdemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "aguardando" | "em_andamento" | "pronto" | "entregue" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: any = { status: data.status };
    if (data.status === "em_andamento") patch.iniciado_em = new Date().toISOString();
    if (data.status === "pronto") patch.finalizado_em = new Date().toISOString();
    if (data.status === "entregue") patch.entregue_em = new Date().toISOString();
    const { error } = await supabase.from("ordens_servico").update(patch).eq("id", data.id).eq("owner_id", userId);
    if (error) throw error;
    return { ok: true };
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
    const [{ data: planos }, { data: ativas }] = await Promise.all([
      context.supabase.from("planos_assinatura").select("*").eq("owner_id", context.userId).order("valor_mensal"),
      context.supabase.from("assinaturas_clientes").select("*, clientes:cliente_id(nome), planos_assinatura:plano_id(nome, valor_mensal)").eq("owner_id", context.userId),
    ]);
    const mrr = (ativas ?? []).filter((a: any) => a.status === "ativa").reduce((s, a: any) => s + Number(a.planos_assinatura?.valor_mensal ?? 0), 0);
    return { planos: planos ?? [], assinaturas: ativas ?? [], mrr, ativas: (ativas ?? []).filter((a: any) => a.status === "ativa").length };
  });

export const upsertPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    nome: z.string().min(1).max(80),
    valor_mensal: z.number().min(0),
    quantidade_lavagens: z.number().int().min(1).max(99),
    beneficios: z.array(z.string()).default([]),
    ativo: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row = { ...data, owner_id: context.userId };
    const { error } = data.id
      ? await context.supabase.from("planos_assinatura").update(row).eq("id", data.id).eq("owner_id", context.userId)
      : await context.supabase.from("planos_assinatura").insert(row);
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
