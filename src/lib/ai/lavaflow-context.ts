type SupabaseLike = {
  from: (table: string) => any;
};

const DAY_MS = 86_400_000;

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function daysBetween(dateIso?: string | null) {
  if (!dateIso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(dateIso).getTime()) / DAY_MS));
}

function rangeForPeriod(period = "30d") {
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const end = new Date();
  const start = new Date(Date.now() - days * DAY_MS);
  return { period, days, startIso: start.toISOString(), endIso: end.toISOString() };
}

function groupBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined) {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    map.set(key, [...(map.get(key) ?? []), row]);
  });
  return map;
}

export async function resolveOwnerScope(supabase: SupabaseLike, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("owner_id, role").eq("user_id", userId);
  const rolePriority: Record<string, number> = { owner: 1, admin: 2, gerente: 3, atendente: 4, lavador: 5, colaborador: 5 };
  const role = (roles ?? [])
    .slice()
    .sort((a: any, b: any) => (rolePriority[a.role] ?? 9) - (rolePriority[b.role] ?? 9))[0];

  return { ownerId: role?.owner_id ?? userId, role: role?.role ?? "owner" };
}

export async function buildBusinessContext(supabase: SupabaseLike, ownerId: string, period = "30d") {
  const range = rangeForPeriod(period);
  const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const ninetyAgo = new Date(Date.now() - 90 * DAY_MS).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: empresa },
    { data: ordensPeriodo },
    { data: ordensMes },
    { data: ordens90 },
    { data: clientes },
    { data: recompensas },
    { data: assinaturas },
    { data: planos },
    { data: agendamentosPeriodo },
    { data: agendamentosHoje },
    { data: funcionarios },
    { data: comissoes },
    { data: upsellsChecklist },
    { data: receitaInfluenciadaRows },
  ] = await Promise.all([
    supabase.from("empresa").select("nome_fantasia").eq("owner_id", ownerId).maybeSingle(),
    supabase.from("ordens_servico").select("id, cliente_id, funcionario_id, servico_id, valor, status, created_at, entregue_em, servicos:servico_id(nome)").eq("owner_id", ownerId).gte("created_at", range.startIso).lte("created_at", range.endIso),
    supabase.from("ordens_servico").select("id, cliente_id, valor, created_at").eq("owner_id", ownerId).gte("created_at", startMonth),
    supabase.from("ordens_servico").select("id, cliente_id, servico_id, funcionario_id, valor, created_at, servicos:servico_id(nome)").eq("owner_id", ownerId).gte("created_at", ninetyAgo),
    supabase.from("clientes").select("id, nome, pontos_saldo, created_at").eq("owner_id", ownerId),
    supabase.from("recompensas").select("nome, custo_pontos, ativo").eq("owner_id", ownerId).eq("ativo", true).order("custo_pontos"),
    supabase.from("assinaturas_clientes").select("id, cliente_id, status, planos_assinatura:plano_id(nome, valor_mensal)").eq("owner_id", ownerId),
    supabase.from("planos_assinatura").select("id, nome, valor_mensal, ativo").eq("owner_id", ownerId),
    supabase.from("agendamentos").select("id, data_agendada, hora_agendada, status, cliente_id, leva_traz, taxa_leva_traz, servicos:servico_id(nome, preco_padrao)").eq("owner_id", ownerId).gte("data_agendada", range.startIso.slice(0, 10)).lte("data_agendada", range.endIso.slice(0, 10)),
    supabase.from("agendamentos").select("id, data_agendada, hora_agendada, status, clientes:cliente_id(nome), servicos:servico_id(nome, preco_padrao)").eq("owner_id", ownerId).eq("data_agendada", today).order("hora_agendada"),
    supabase.from("funcionarios").select("id, nome, ativo").eq("owner_id", ownerId),
    supabase.from("comissoes").select("id, funcionario_id, valor, pagamento_id, created_at").eq("owner_id", ownerId).is("pagamento_id", null),
    supabase.from("os_upsell_oportunidades").select("id, servico_sugerido, valor_estimado, status, origem_item_label, created_at").eq("owner_id", ownerId).gte("created_at", range.startIso).lte("created_at", range.endIso),
    supabase.from("receita_influenciada").select("id, origem, valor, created_at").eq("owner_id", ownerId).gte("created_at", range.startIso).lte("created_at", range.endIso),
  ]);

  const ordens = ordensPeriodo ?? [];
  const ordensRecentes = ordens90 ?? [];
  const clientesRows = clientes ?? [];
  const receitaPeriodo = ordens.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
  const receitaMesAtual = (ordensMes ?? []).reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
  const ticketMedio = ordens.length ? receitaPeriodo / ordens.length : 0;

  const byCliente90 = groupBy(ordensRecentes, (row: any) => row.cliente_id);
  const clientesAtivos = Array.from(byCliente90.keys()).length;
  const clientesInativosRows = clientesRows
    .map((cliente: any) => {
      const visitas = byCliente90.get(cliente.id) ?? [];
      const ultima = visitas.map((v: any) => v.created_at).sort().at(-1) ?? null;
      const totalGasto = visitas.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
      const servicos = groupBy(visitas, (row: any) => row.servicos?.nome ?? "Sem servico");
      const servicoMaisComum = Array.from(servicos.entries()).sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? null;
      return {
        nome: cliente.nome,
        dias_sem_retornar: daysBetween(ultima) ?? 999,
        total_gasto: roundMoney(totalGasto),
        pontos: Number(cliente.pontos_saldo ?? 0),
        recompensa_disponivel: false,
        servico_mais_comum: servicoMaisComum,
      };
    })
    .filter((cliente: any) => cliente.dias_sem_retornar >= 45)
    .sort((a: any, b: any) => b.total_gasto - a.total_gasto)
    .slice(0, 20);

  const recompensasAtivas = (recompensas ?? []).sort((a: any, b: any) => Number(a.custo_pontos) - Number(b.custo_pontos));
  const menorRecompensa = Number(recompensasAtivas[0]?.custo_pontos ?? 0);
  const clientesComRecompensa = menorRecompensa
    ? clientesRows.filter((cliente: any) => Number(cliente.pontos_saldo ?? 0) >= menorRecompensa).length
    : 0;
  const clientesProximosRecompensa = menorRecompensa
    ? clientesRows.filter((cliente: any) => {
      const faltam = menorRecompensa - Number(cliente.pontos_saldo ?? 0);
      return faltam > 0 && faltam <= 50;
    }).length
    : 0;

  clientesInativosRows.forEach((cliente: any) => {
    cliente.recompensa_disponivel = menorRecompensa > 0 && cliente.pontos >= menorRecompensa;
  });

  const assinaturasAtivas = (assinaturas ?? []).filter((row: any) => row.status === "ativa");
  const assinantesAtivos = new Set(assinaturasAtivas.map((row: any) => row.cliente_id));
  const mrr = assinaturasAtivas.reduce((sum: number, row: any) => sum + Number(row.planos_assinatura?.valor_mensal ?? 0), 0);
  const candidatosAssinatura = Array.from(byCliente90.entries())
    .filter(([clienteId, visitas]) => visitas.length >= 4 && !assinantesAtivos.has(clienteId))
    .length;

  const servicosVendidos = groupBy(ordensRecentes, (row: any) => row.servicos?.nome ?? "Sem servico");
  const servicosRanking = Array.from(servicosVendidos.entries())
    .map(([nome, rows]: [string, any[]]) => ({
      nome,
      quantidade: rows.length,
      receita: roundMoney(rows.reduce((sum, row) => sum + Number(row.valor ?? 0), 0)),
    }))
    .sort((a, b) => b.receita - a.receita);

  const funcionariosRows = funcionarios ?? [];
  const comissoesPendentes = comissoes ?? [];
  const upsellRows = upsellsChecklist ?? [];
  const upsellsAbertos = upsellRows.filter((row: any) => ["sugerida", "oferecida"].includes(row.status));
  const upsellsAceitos = upsellRows.filter((row: any) => row.status === "aceita");
  const potencialUpsellChecklist = upsellsAbertos.reduce((sum: number, row: any) => sum + Number(row.valor_estimado ?? 0), 0);
  const receitaUpsellAceita = upsellsAceitos.reduce((sum: number, row: any) => sum + Number(row.valor_estimado ?? 0), 0);
  const upsellsPorServico = Array.from(groupBy(upsellRows, (row: any) => row.servico_sugerido).entries())
    .map(([servico, rows]: [string, any[]]) => ({
      servico,
      quantidade: rows.length,
      potencial: roundMoney(rows.reduce((sum: number, row: any) => sum + Number(row.valor_estimado ?? 0), 0)),
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);
  const receitaInfluenciadaBase = [...(receitaInfluenciadaRows ?? [])];
  const levaTrazInfluenciado = (agendamentosPeriodo ?? [])
    .filter((row: any) => row.leva_traz && Number(row.taxa_leva_traz ?? 0) > 0)
    .map((row: any) => ({ origem: "LEVA_ETRAZ", valor: Number(row.taxa_leva_traz ?? 0), created_at: `${row.data_agendada}T12:00:00.000Z` }));
  const receitaInfluenciada = [...receitaInfluenciadaBase, ...levaTrazInfluenciado];
  const receitaInfluenciadaTotal = receitaInfluenciada.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0);
  const receitaPorOrigem = Array.from(groupBy(receitaInfluenciada, (row: any) => row.origem).entries())
    .map(([origem, rows]: [string, any[]]) => ({
      origem,
      quantidade: rows.length,
      valor: roundMoney(rows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0)),
    }))
    .sort((a: any, b: any) => b.valor - a.valor);
  const byFuncionario = groupBy(ordens, (row: any) => row.funcionario_id);
  const rankingColaboradores = funcionariosRows
    .map((func: any) => {
      const rows = byFuncionario.get(func.id) ?? [];
      return {
        nome: func.nome,
        ordens: rows.length,
        receita: roundMoney(rows.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0)),
        comissao_pendente: roundMoney(comissoesPendentes.filter((c: any) => c.funcionario_id === func.id).reduce((sum: number, c: any) => sum + Number(c.valor ?? 0), 0)),
      };
    })
    .sort((a: any, b: any) => b.receita - a.receita);

  const agendaRows = agendamentosPeriodo ?? [];
  const compareceu = agendaRows.filter((row: any) => ["concluido", "confirmado"].includes(row.status)).length;
  const naoCompareceu = agendaRows.filter((row: any) => ["cancelado", "nao_compareceu"].includes(row.status)).length;
  const agendamentosValidos = compareceu + naoCompareceu;
  const porDiaSemana = Array(7).fill(0);
  ordens.forEach((row: any) => {
    porDiaSemana[new Date(row.created_at).getDay()] += Number(row.valor ?? 0);
  });
  const diasLabels = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
  const diasFracos = porDiaSemana
    .map((receita, index) => ({ dia: diasLabels[index], receita: roundMoney(receita) }))
    .sort((a, b) => a.receita - b.receita)
    .slice(0, 2);

  const healthScore = Math.round(Math.max(0, Math.min(100,
    (clientesAtivos / Math.max(1, clientesRows.length)) * 35 +
    (ticketMedio >= 60 ? 20 : (ticketMedio / 60) * 20) +
    (mrr > 0 ? 20 : 0) +
    (ordens.length > 0 ? 25 : 0),
  )));

  return {
    business: {
      nome_empresa: empresa?.nome_fantasia ?? "Lava-rapido",
      segmento: "lava-rapido e estetica automotiva",
      periodo_analisado: range.period,
      data_referencia: new Date().toISOString(),
    },
    metrics: {
      receita_periodo: roundMoney(receitaPeriodo),
      receita_mes_atual: roundMoney(receitaMesAtual),
      ticket_medio: roundMoney(ticketMedio),
      lavagens_periodo: ordens.length,
      clientes_ativos: clientesAtivos,
      clientes_inativos: Math.max(0, clientesRows.length - clientesAtivos),
      taxa_retorno: clientesRows.length ? roundMoney(clientesAtivos / clientesRows.length) : 0,
      mrr: roundMoney(mrr),
      assinantes_ativos: assinaturasAtivas.length,
      health_score_calculado: healthScore,
    },
    opportunities: {
      clientes_inativos: clientesInativosRows,
      clientes_com_recompensa: clientesComRecompensa,
      clientes_proximos_recompensa: clientesProximosRecompensa,
      candidatos_assinatura: candidatosAssinatura,
      servicos_baixa_adesao: servicosRanking.slice(-3),
      horarios_ociosos: [],
      dias_fracos: diasFracos,
      comissoes_pendentes: comissoesPendentes.length,
      upsell_checklist_abertas: upsellsAbertos.length,
      upsell_checklist_potencial: roundMoney(potencialUpsellChecklist),
      upsell_checklist_aceitas: upsellsAceitos.length,
      upsell_checklist_receita_aceita: roundMoney(receitaUpsellAceita),
      upsell_checklist_por_servico: upsellsPorServico,
      receita_influenciada_total: roundMoney(receitaInfluenciadaTotal),
      receita_influenciada_percentual: receitaPeriodo ? roundMoney(receitaInfluenciadaTotal / receitaPeriodo) : 0,
      receita_influenciada_por_origem: receitaPorOrigem,
    },
    team: {
      ranking_colaboradores: rankingColaboradores.slice(0, 8),
      produtividade_periodo: rankingColaboradores,
      comissao_total_pendente: roundMoney(comissoesPendentes.reduce((sum: number, row: any) => sum + Number(row.valor ?? 0), 0)),
    },
    appointments: {
      agendamentos_hoje: (agendamentosHoje ?? []).length,
      proximos_agendamentos: (agendamentosHoje ?? []).slice(0, 6).map((row: any) => ({
        hora: row.hora_agendada,
        cliente: row.clientes?.nome ?? "Cliente",
        servico: row.servicos?.nome ?? "Servico",
        status: row.status,
      })),
      taxa_comparecimento: agendamentosValidos ? roundMoney(compareceu / agendamentosValidos) : 0,
      nao_comparecimentos: naoCompareceu,
    },
    loyalty: {
      pontos_distribuidos: clientesRows.reduce((sum: number, row: any) => sum + Number(row.pontos_saldo ?? 0), 0),
      recompensas_disponiveis: recompensasAtivas.length,
      clientes_participantes: clientesRows.filter((row: any) => Number(row.pontos_saldo ?? 0) > 0).length,
    },
    subscriptions: {
      planos_ativos: (planos ?? []).filter((row: any) => row.ativo).length,
      assinantes: assinaturasAtivas.length,
      mrr: roundMoney(mrr),
      candidatos_upgrade: candidatosAssinatura,
    },
    derived: {
      servicos_mais_vendidos: servicosRanking.slice(0, 5),
      ticket_para_estimativas: roundMoney(ticketMedio || 50),
    },
  };
}
