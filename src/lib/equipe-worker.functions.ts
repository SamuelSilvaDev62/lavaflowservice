import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const APP_TIMEZONE_OFFSET = "-03:00";

async function tokenHash(token: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}

function localDateIso(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfLocalDayIso() {
  return `${localDateIso()}T00:00:00${APP_TIMEZONE_OFFSET}`;
}

function startOfLocalMonthIso() {
  const [year, month] = localDateIso().split("-");
  return `${year}-${month}-01T00:00:00${APP_TIMEZONE_OFFSET}`;
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function calcComissaoOrdem(
  ordem: any,
  funcionario: any,
  regrasServico: Map<string, { tipo: string; valor: number }>,
) {
  let tipo = funcionario.comissao_tipo;
  let valorRegra = Number(funcionario.comissao_valor ?? 0);

  if (funcionario.comissao_modo === "por_servico" && ordem.servico_id) {
    const regra = regrasServico.get(ordem.servico_id);
    if (regra) {
      tipo = regra.tipo;
      valorRegra = Number(regra.valor ?? 0);
    }
  }

  if (tipo === "percentual") {
    return roundMoney(Number(ordem.valor ?? 0) * valorRegra / 100);
  }
  return roundMoney(valorRegra);
}

async function getWorkerSession(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sessao, error } = await supabaseAdmin
    .from("equipe_sessoes")
    .select("id, owner_id, funcionario_id, expires_at")
    .eq("token_hash", await tokenHash(token))
    .maybeSingle();

  if (error) throw error;
  if (!sessao || new Date(sessao.expires_at).getTime() <= Date.now()) {
    throw new Error("Sessao expirada");
  }

  return { supabaseAdmin, sessao };
}

/**
 * Resumo financeiro pessoal do colaborador autenticado pelo Modo Equipe.
 *
 * É somente leitura: não cria comissões, não marca pagamento e não altera OS.
 * `ganhosHoje`/`ganhoMes` são calculados pelas regras vigentes sobre OS entregues.
 * `aReceber` usa comissões materializadas em aberto e complementa, sem duplicar,
 * OS entregues nos últimos 180 dias que ainda não tenham linha em `comissoes`.
 */
export const getEquipeGanhos = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(20) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, sessao } = await getWorkerSession(data.token);

    const { data: funcionario, error: funcionarioError } = await supabaseAdmin
      .from("funcionarios")
      .select("id, ativo, comissao_tipo, comissao_valor, comissao_modo")
      .eq("id", sessao.funcionario_id)
      .eq("owner_id", sessao.owner_id)
      .maybeSingle();

    if (funcionarioError) throw funcionarioError;
    if (!funcionario?.ativo) throw new Error("Colaborador inativo");

    const inicioHoje = startOfLocalDayIso();
    const inicioMes = startOfLocalMonthIso();
    const inicioHistorico = new Date(Date.now() - 180 * 86_400_000).toISOString();

    const [
      { data: ordensMes, error: ordensMesError },
      { data: ordensHistorico, error: ordensHistoricoError },
      { data: regras, error: regrasError },
      { data: comissoes, error: comissoesError },
      { data: pagamentos, error: pagamentosError },
    ] = await Promise.all([
      supabaseAdmin
        .from("ordens_servico")
        .select("id, valor, servico_id, entregue_em")
        .eq("owner_id", sessao.owner_id)
        .eq("funcionario_id", funcionario.id)
        .eq("status", "entregue")
        .gte("entregue_em", inicioMes),
      supabaseAdmin
        .from("ordens_servico")
        .select("id, valor, servico_id, entregue_em")
        .eq("owner_id", sessao.owner_id)
        .eq("funcionario_id", funcionario.id)
        .eq("status", "entregue")
        .gte("entregue_em", inicioHistorico),
      supabaseAdmin
        .from("comissoes_servico")
        .select("servico_id, tipo, valor")
        .eq("owner_id", sessao.owner_id)
        .eq("funcionario_id", funcionario.id),
      supabaseAdmin
        .from("comissoes")
        .select("ordem_id, valor, pagamento_id")
        .eq("owner_id", sessao.owner_id)
        .eq("funcionario_id", funcionario.id),
      supabaseAdmin
        .from("pagamentos_comissao")
        .select("valor, pago_em")
        .eq("owner_id", sessao.owner_id)
        .eq("funcionario_id", funcionario.id)
        .gte("pago_em", inicioMes),
    ]);

    if (ordensMesError) throw ordensMesError;
    if (ordensHistoricoError) throw ordensHistoricoError;
    if (regrasError) throw regrasError;
    if (comissoesError) throw comissoesError;
    if (pagamentosError) throw pagamentosError;

    const regrasByServico = new Map<string, { tipo: string; valor: number }>(
      (regras ?? []).map((r: any) => [
        r.servico_id,
        { tipo: r.tipo, valor: Number(r.valor ?? 0) },
      ]),
    );

    const ganhoPorOrdem = (ordem: any) => calcComissaoOrdem(ordem, funcionario, regrasByServico);
    const mes = ordensMes ?? [];
    const hoje = mes.filter((o: any) => o.entregue_em && new Date(o.entregue_em).getTime() >= new Date(inicioHoje).getTime());

    const ganhosHoje = roundMoney(hoje.reduce((sum: number, o: any) => sum + ganhoPorOrdem(o), 0));
    const ganhoMes = roundMoney(mes.reduce((sum: number, o: any) => sum + ganhoPorOrdem(o), 0));
    const faturamentoHoje = roundMoney(hoje.reduce((sum: number, o: any) => sum + Number(o.valor ?? 0), 0));

    const comissoesRows = comissoes ?? [];
    const ordensComComissao = new Set(
      comissoesRows.map((c: any) => c.ordem_id).filter(Boolean),
    );
    const abertoMaterializado = comissoesRows
      .filter((c: any) => !c.pagamento_id)
      .reduce((sum: number, c: any) => sum + Number(c.valor ?? 0), 0);

    // Complemento read-only para o painel refletir uma OS recém-entregue mesmo antes
    // de o painel administrativo materializar a linha de comissão.
    const abertoAindaNaoMaterializado = (ordensHistorico ?? [])
      .filter((o: any) => !ordensComComissao.has(o.id))
      .reduce((sum: number, o: any) => sum + ganhoPorOrdem(o), 0);

    const aReceber = roundMoney(abertoMaterializado + abertoAindaNaoMaterializado);
    const recebidoMes = roundMoney(
      (pagamentos ?? []).reduce((sum: number, p: any) => sum + Number(p.valor ?? 0), 0),
    );

    let regraLabel = "Sem comissão configurada";
    if (funcionario.comissao_modo === "por_servico") {
      regraLabel = "Comissão personalizada por serviço";
    } else if (funcionario.comissao_tipo === "percentual") {
      regraLabel = `${Number(funcionario.comissao_valor ?? 0)}% por OS`;
    } else if (Number(funcionario.comissao_valor ?? 0) > 0) {
      regraLabel = `R$ ${Number(funcionario.comissao_valor ?? 0).toFixed(2)} por OS`;
    }

    return {
      ganhosHoje,
      ganhoMes,
      aReceber,
      recebidoMes,
      servicosHoje: hoje.length,
      faturamentoHoje,
      regraLabel,
      atualizadoEm: new Date().toISOString(),
    };
  });
