// Mensagens inteligentes do programa de fidelidade.
// Calcula pontos ganhos, saldo novo, próxima recompensa e monta mensagem personalizada
// para envio via WhatsApp quando o veículo fica pronto.

import { brl } from "./format";

export type RecompensaMin = { id: string; nome: string; custo_pontos: number; ativo?: boolean };
export type FidelidadeConfigMin = { pontos_por_lavagem: number; pontos_por_real: number };

export type CenarioPronto = "padrao" | "disponivel" | "vip";

export type BuildReadyInput = {
  cliente: { nome: string; pontos_saldo: number; total_visitas?: number };
  ordem: { servico_nome?: string | null; valor: number; placa?: string | null };
  config: FidelidadeConfigMin;
  recompensas: RecompensaMin[];
  vipLimites?: { visitas: number; pontos: number };
  templates?: Partial<Record<TplKey, string>>;
};

export type TplKey =
  | "fidelidade_pronto_padrao"
  | "fidelidade_pronto_disponivel"
  | "fidelidade_pronto_vip"
  | "fidelidade_extrato";

export const FIDELIDADE_DEFAULTS: Record<TplKey, string> = {
  fidelidade_pronto_padrao:
`Olá {nome}! 🚗✨

Seu veículo já está pronto para retirada.

Serviço realizado: {servico}
Valor: {valor}

🎁 Você ganhou {pontos_ganhos} pontos nesta visita.
Saldo atual: {saldo_atual} pontos

Faltam apenas {pontos_faltantes} pontos para resgatar:
✨ {proxima_recompensa}

Obrigado pela preferência! Esperamos você novamente em breve.`,

  fidelidade_pronto_disponivel:
`Olá {nome}! 🚗✨

Seu veículo já está pronto para retirada.

🎉 Você ganhou {pontos_ganhos} pontos nesta visita.
Saldo atual: {saldo_atual} pontos

Você já pode resgatar:
✅ {recompensa_disponivel}

Apresente esta mensagem em sua próxima visita para utilizar seu benefício.

Obrigado pela preferência!`,

  fidelidade_pronto_vip:
`Olá {nome}! 🚗✨

Seu veículo já está pronto para retirada.

🎁 Você ganhou {pontos_ganhos} pontos nesta visita.
Saldo atual: {saldo_atual} pontos

⭐ Obrigado por ser um de nossos clientes mais frequentes.
Seu apoio é muito importante para nós.`,

  fidelidade_extrato:
`Programa de Fidelidade 🚗🎁

Saldo atual: {saldo_atual} pontos

Últimos ganhos:
{historico}

Benefícios disponíveis:
{disponiveis}

Obrigado por fazer parte do nosso programa de fidelidade.`,
};

export function calcularPontosGanhos(valor: number, config: FidelidadeConfigMin) {
  return (config.pontos_por_lavagem ?? 0) + Math.floor((valor ?? 0) * (config.pontos_por_real ?? 0));
}

export function escolherCenario(
  saldoNovo: number,
  visitas: number,
  recompensas: RecompensaMin[],
  vipLimites = { visitas: 10, pontos: 1000 },
): CenarioPronto {
  const ativas = recompensas.filter((r) => r.ativo !== false).sort((a, b) => a.custo_pontos - b.custo_pontos);
  const temDisponivel = ativas.some((r) => r.custo_pontos <= saldoNovo);
  const isVip = visitas >= vipLimites.visitas || saldoNovo >= vipLimites.pontos;
  if (isVip) return "vip";
  if (temDisponivel) return "disponivel";
  return "padrao";
}

function render(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function buildReadyVehicleMessage(input: BuildReadyInput): {
  cenario: CenarioPronto;
  message: string;
  pontosGanhos: number;
  saldoNovo: number;
  recompensaDisponivel?: RecompensaMin;
  proximaRecompensa?: RecompensaMin;
  pontosFaltantes: number;
} {
  const { cliente, ordem, config, recompensas } = input;
  const pontosGanhos = calcularPontosGanhos(ordem.valor, config);
  const saldoNovo = (cliente.pontos_saldo ?? 0) + pontosGanhos;
  const visitas = cliente.total_visitas ?? 0;

  const ativas = recompensas.filter((r) => r.ativo !== false).sort((a, b) => a.custo_pontos - b.custo_pontos);
  const disponiveis = ativas.filter((r) => r.custo_pontos <= saldoNovo);
  const recompensaDisponivel = disponiveis[disponiveis.length - 1];
  const proximaRecompensa = ativas.find((r) => r.custo_pontos > saldoNovo);
  const pontosFaltantes = proximaRecompensa ? proximaRecompensa.custo_pontos - saldoNovo : 0;

  const cenario = escolherCenario(saldoNovo, visitas, recompensas, input.vipLimites);

  const tplKey: TplKey =
    cenario === "vip" ? "fidelidade_pronto_vip"
    : cenario === "disponivel" ? "fidelidade_pronto_disponivel"
    : "fidelidade_pronto_padrao";

  // Se cenário padrão e não há próxima recompensa, usa fallback simples.
  let tpl = input.templates?.[tplKey] ?? FIDELIDADE_DEFAULTS[tplKey];
  if (cenario === "padrao" && !proximaRecompensa) {
    tpl = `Olá {nome}! 🚗✨

Seu veículo já está pronto para retirada.

Serviço realizado: {servico}
Valor: {valor}

🎁 Você ganhou {pontos_ganhos} pontos nesta visita.
Saldo atual: {saldo_atual} pontos

Obrigado pela preferência! Esperamos você novamente em breve.`;
  }

  const message = render(tpl, {
    nome: cliente.nome.split(" ")[0],
    servico: ordem.servico_nome ?? "Lavagem",
    valor: brl(ordem.valor),
    placa: ordem.placa ?? "",
    pontos_ganhos: pontosGanhos,
    saldo_atual: saldoNovo,
    proxima_recompensa: proximaRecompensa?.nome ?? "",
    pontos_faltantes: pontosFaltantes,
    recompensa_disponivel: recompensaDisponivel?.nome ?? "",
  });

  return { cenario, message, pontosGanhos, saldoNovo, recompensaDisponivel, proximaRecompensa, pontosFaltantes };
}

export type BuildExtratoInput = {
  cliente: { nome: string; pontos_saldo: number };
  movimentos: Array<{ pontos: number; servico_nome?: string | null; created_at: string }>;
  recompensas: RecompensaMin[];
  template?: string;
};

export function buildExtratoMessage(input: BuildExtratoInput): string {
  const tpl = input.template ?? FIDELIDADE_DEFAULTS.fidelidade_extrato;
  const ativas = input.recompensas.filter((r) => r.ativo !== false).sort((a, b) => a.custo_pontos - b.custo_pontos);
  const disponiveis = ativas.filter((r) => r.custo_pontos <= input.cliente.pontos_saldo);

  const historicoLinhas = input.movimentos.slice(0, 5).map((m) => {
    const sinal = m.pontos >= 0 ? "+" : "";
    return `${sinal}${m.pontos} pontos — ${m.servico_nome ?? "Lavagem"}`;
  });
  const historico = historicoLinhas.length ? historicoLinhas.join("\n") : "Sem movimentações recentes.";

  const disponiveisLinhas = disponiveis.length
    ? disponiveis.map((r) => `✅ ${r.nome}`).join("\n")
    : ativas.length
    ? `Faltam pontos para o próximo benefício: ${ativas[0].nome} (${ativas[0].custo_pontos} pts)`
    : "Em breve teremos novas recompensas disponíveis.";

  return tpl
    .replace(/\{nome\}/g, input.cliente.nome.split(" ")[0])
    .replace(/\{saldo_atual\}/g, String(input.cliente.pontos_saldo))
    .replace(/\{historico\}/g, historico)
    .replace(/\{disponiveis\}/g, disponiveisLinhas);
}

// Helper: lê templates personalizados do localStorage (mesmo storage do whatsapp.ts).
const STORAGE_KEY = "lavaflow_wa_templates";

export function getFidelidadeTemplates(): Partial<Record<TplKey, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, string>;
    const out: Partial<Record<TplKey, string>> = {};
    (Object.keys(FIDELIDADE_DEFAULTS) as TplKey[]).forEach((k) => {
      if (map[k]) out[k] = map[k];
    });
    return out;
  } catch {
    return {};
  }
}
