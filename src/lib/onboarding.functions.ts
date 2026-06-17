import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  NOMES_BR, MODELOS, CORES, ORIGENS, SERVICOS_DEMO, FUNCIONARIOS_DEMO,
  PLANOS_DEMO, RECOMPENSAS_DEMO, TIPOS_INTERACAO, fakePlaca, fakeTelefone,
} from "./demo-seed";

const STATUS_DIST: Array<"aguardando" | "em_lavagem" | "finalizacao" | "pronto" | "entregue"> = [
  "aguardando", "em_lavagem", "finalizacao", "pronto",
];

// ============ STATE ============
export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [emp, c, s, f, p, o] = await Promise.all([
      supabase.from("empresa").select("nome_fantasia, telefone, onboarding_status, onboarding_completed_steps, tour_completed_at").eq("owner_id", userId).maybeSingle(),
      supabase.from("clientes").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("servicos").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("funcionarios").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("planos_assinatura").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("ordens_servico").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    ]);
    const empresa = emp.data;
    return {
      status: (empresa?.onboarding_status ?? "pending") as "pending" | "demo" | "empty" | "done",
      tourCompletedAt: empresa?.tour_completed_at as string | null | undefined,
      completedSteps: (empresa?.onboarding_completed_steps ?? []) as string[],
      empresaConfigurada: !!(empresa && empresa.nome_fantasia && empresa.nome_fantasia !== "Meu Lava-Rápido") || !!empresa?.telefone,
      counts: {
        clientes: c.count ?? 0,
        servicos: s.count ?? 0,
        funcionarios: f.count ?? 0,
        planos: p.count ?? 0,
        ordens: o.count ?? 0,
      },
    };
  });

// ============ CHOICE ============
export const setOnboardingChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ choice: z.enum(["demo", "empty"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.choice === "demo") {
      await runSeed(supabase, userId);
    }
    const newStatus = data.choice === "demo" ? "demo" : "empty";
    await supabase.from("empresa").update({ onboarding_status: newStatus }).eq("owner_id", userId);
    return { ok: true };
  });

// ============ TOUR ============
export const dismissTour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("empresa").update({ tour_completed_at: new Date().toISOString() }).eq("owner_id", userId);
    return { ok: true };
  });

// ============ CHECKLIST ============
export const markStepDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ step: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: emp } = await supabase.from("empresa").select("onboarding_completed_steps").eq("owner_id", userId).maybeSingle();
    const current = new Set<string>(emp?.onboarding_completed_steps ?? []);
    current.add(data.step);
    await supabase.from("empresa").update({ onboarding_completed_steps: Array.from(current) }).eq("owner_id", userId);
    return { ok: true };
  });

export const finishOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("empresa").update({ onboarding_status: "done" }).eq("owner_id", userId);
    return { ok: true };
  });

// ============ SEED ============
async function runSeed(supabase: any, userId: string) {
  // Idempotência
  const { count } = await supabase.from("clientes").select("id", { count: "exact", head: true }).eq("owner_id", userId);
  if ((count ?? 0) > 0) return;

  // Empresa
  await supabase.from("empresa").update({
    nome_fantasia: "LavaFlow Demo",
    telefone: "(11) 4002-8922",
    whatsapp: "(11) 99999-0000",
    endereco: "Av. Paulista, 1000 — São Paulo/SP",
    horario_funcionamento: "Seg–Sáb · 8h às 19h",
  }).eq("owner_id", userId);

  // Serviços
  const { data: servicos } = await supabase.from("servicos").insert(
    SERVICOS_DEMO.map((s) => ({ ...s, owner_id: userId, ativo: true }))
  ).select();

  // Funcionários
  const { data: funcionarios } = await supabase.from("funcionarios").insert(
    FUNCIONARIOS_DEMO.map((f, i) => ({ ...f, owner_id: userId, ativo: true, telefone: fakeTelefone(i + 100) }))
  ).select();

  // Planos
  const { data: planos } = await supabase.from("planos_assinatura").insert(
    PLANOS_DEMO.map((p) => ({ ...p, owner_id: userId, ativo: true }))
  ).select();

  // Recompensas
  await supabase.from("recompensas").insert(
    RECOMPENSAS_DEMO.map((r) => ({ ...r, owner_id: userId, ativo: true }))
  );

  // Clientes
  const clientesPayload = NOMES_BR.map((nome, i) => ({
    owner_id: userId,
    nome,
    telefone: fakeTelefone(i),
    origem_cliente: ORIGENS[i % ORIGENS.length],
    pontos_saldo: 0,
    created_at: new Date(Date.now() - (90 - i * 3) * 86_400_000).toISOString(),
  }));
  const { data: clientes } = await supabase.from("clientes").insert(clientesPayload).select();
  if (!clientes || !servicos || !funcionarios || !planos) return;

  // Veículos — 35 distribuídos entre 25 clientes
  const veiculosPayload = Array.from({ length: 35 }, (_, i) => ({
    owner_id: userId,
    cliente_id: clientes[i % clientes.length].id,
    placa: fakePlaca(i),
    modelo: MODELOS[i % MODELOS.length],
    cor: CORES[i % CORES.length],
  }));
  const { data: veiculos } = await supabase.from("veiculos").insert(veiculosPayload).select();
  if (!veiculos) return;

  // Assinaturas — 8 clientes
  const assinaturasPayload = Array.from({ length: 8 }, (_, i) => ({
    owner_id: userId,
    cliente_id: clientes[i].id,
    plano_id: planos[i % planos.length].id,
    inicio: new Date(Date.now() - (30 + i * 5) * 86_400_000).toISOString().slice(0, 10),
    proxima_cobranca: new Date(Date.now() + (30 - i * 2) * 86_400_000).toISOString().slice(0, 10),
    status: "ativa",
    lavagens_usadas_mes: i % 4,
  }));
  await supabase.from("assinaturas_clientes").insert(assinaturasPayload);

  // OS — 150 distribuídas, maioria entregue
  // Inserimos primeiro com status entregue + entregue_em, mas o trigger só dispara em UPDATE.
  // Estratégia: inserir em status aguardando e depois atualizar para entregue em lote.
  const osBase = Array.from({ length: 150 }, (_, i) => {
    const cliente = clientes[i % clientes.length];
    const veiculo = veiculos[i % veiculos.length];
    const servico = servicos[i % servicos.length];
    const funcionario = funcionarios[i % funcionarios.length];
    const diasAtras = Math.floor((i * 0.6) % 90);
    const createdAt = new Date(Date.now() - diasAtras * 86_400_000);
    const valor = Number(servico.preco_padrao) * (0.9 + ((i % 5) * 0.05));
    return {
      owner_id: userId,
      cliente_id: cliente.id,
      veiculo_id: veiculo.id,
      servico_id: servico.id,
      funcionario_id: funcionario.id,
      valor: Math.round(valor * 100) / 100,
      posicao: i,
      status: "aguardando" as const,
      created_at: createdAt.toISOString(),
    };
  });

  const { data: ordens } = await supabase.from("ordens_servico").insert(osBase).select();
  if (!ordens) return;

  // 90% entregues, resto distribuído entre os outros status
  const updates = ordens.map((o: any, i: number) => {
    if (i < 135) {
      const baseDate = new Date(o.created_at);
      return supabase.from("ordens_servico").update({
        status: "entregue",
        iniciado_em: new Date(baseDate.getTime() + 10 * 60_000).toISOString(),
        finalizado_em: new Date(baseDate.getTime() + 60 * 60_000).toISOString(),
        entregue_em: new Date(baseDate.getTime() + 80 * 60_000).toISOString(),
      }).eq("id", o.id);
    }
    const status = STATUS_DIST[(i - 135) % STATUS_DIST.length];
    return supabase.from("ordens_servico").update({ status }).eq("id", o.id);
  });
  // Executa em batches de 20 para evitar pressão
  for (let i = 0; i < updates.length; i += 20) {
    await Promise.all(updates.slice(i, i + 20));
  }

  // Avaliações — mix de 5★, 4★ e algumas 2-3★ com comentário para alimentar oportunidades
  const entregues = ordens.slice(0, 135);
  const avaliacoesPayload = entregues.slice(0, 60).map((o: any, i: number) => {
    const ruim = i < 2; // 2 avaliações ruins
    return {
      owner_id: userId,
      cliente_id: o.cliente_id,
      ordem_id: o.id,
      nota: ruim ? (i === 0 ? 2 : 3) : (i % 8 === 0 ? 4 : 5),
      comentario: ruim
        ? (i === 0 ? "Demorou muito para entregar." : "O carro voltou com manchas no painel.")
        : (i % 3 === 0 ? "Atendimento excelente, voltarei!" : null),
    };
  });
  await supabase.from("avaliacoes").insert(avaliacoesPayload);

  // Interações — 40
  const interacoesPayload = Array.from({ length: 40 }, (_, i) => ({
    owner_id: userId,
    cliente_id: clientes[i % clientes.length].id,
    tipo: TIPOS_INTERACAO[i % TIPOS_INTERACAO.length],
    descricao: ["Confirmação de horário", "Lembrete de retorno", "Pesquisa de satisfação"][i % 3],
  }));
  await supabase.from("interacoes_clientes").insert(interacoesPayload);

  // Resgates de recompensas — 3 movimentos de débito para alimentar /fidelidade
  const { data: recompensasAtivas } = await supabase
    .from("recompensas").select("id, custo_pontos").eq("owner_id", userId).limit(2);
  if (recompensasAtivas && recompensasAtivas.length > 0) {
    const resgates = Array.from({ length: 3 }, (_, i) => ({
      owner_id: userId,
      cliente_id: clientes[i].id,
      tipo: "debito" as const,
      pontos: -Number(recompensasAtivas[i % recompensasAtivas.length].custo_pontos),
      observacao: `Resgate: ${i === 0 ? "Lavagem simples grátis" : "20% off"}`,
    }));
    await supabase.from("pontos_movimentos").insert(resgates);
  }

  // Assinaturas pendentes — 2, para o dashboard mostrar o card de pendências
  const pendentes = [0, 1].map((i) => ({
    owner_id: userId,
    cliente_id: clientes[10 + i].id,
    plano_id: planos[i % planos.length].id,
    inicio: new Date().toISOString().slice(0, 10),
    status: "pendente" as const,
    metodo_pagamento: "pix",
    observacoes: "Aguardando confirmação de PIX",
  }));
  await supabase.from("assinaturas_clientes").insert(pendentes);

  // Agendamentos futuros — 5 distribuídos nos próximos 7 dias
  const horas = ["09:00", "10:30", "14:00", "15:30", "17:00"];
  const agendamentos = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(Date.now() + (i + 1) * 86_400_000);
    return {
      owner_id: userId,
      cliente_id: clientes[(i + 5) % clientes.length].id,
      veiculo_id: veiculos[(i + 5) % veiculos.length].id,
      servico_id: servicos[i % servicos.length].id,
      data_agendada: d.toISOString().slice(0, 10),
      hora_agendada: horas[i],
      status: (i === 0 ? "confirmado" : "agendado") as any,
      origem: "demo",
    };
  });
  await supabase.from("agendamentos").insert(agendamentos);

  // Clientes recuperados (impacto do mês) — 3 clientes com OS antiga (50d) + OS este mês
  const recIds = [clientes[15].id, clientes[16].id, clientes[17].id];
  const recOSAntigas = recIds.map((cid, i) => ({
    owner_id: userId,
    cliente_id: cid,
    veiculo_id: veiculos[i % veiculos.length].id,
    servico_id: servicos[i % servicos.length].id,
    funcionario_id: funcionarios[i % funcionarios.length].id,
    valor: Number(servicos[i % servicos.length].preco_padrao),
    status: "entregue" as const,
    created_at: new Date(Date.now() - 50 * 86_400_000).toISOString(),
    entregue_em: new Date(Date.now() - 50 * 86_400_000 + 80 * 60_000).toISOString(),
  }));
  const recOSAgora = recIds.map((cid, i) => {
    const created = new Date(Date.now() - i * 86_400_000);
    return {
      owner_id: userId,
      cliente_id: cid,
      veiculo_id: veiculos[(i + 3) % veiculos.length].id,
      servico_id: servicos[(i + 1) % servicos.length].id,
      funcionario_id: funcionarios[i % funcionarios.length].id,
      valor: Number(servicos[(i + 1) % servicos.length].preco_padrao),
      status: "entregue" as const,
      created_at: created.toISOString(),
      entregue_em: new Date(created.getTime() + 80 * 60_000).toISOString(),
    };
  });
  await supabase.from("ordens_servico").insert([...recOSAntigas, ...recOSAgora]);
}

