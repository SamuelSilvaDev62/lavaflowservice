import { generateStructuredConsultor } from "./openai";
import type { ConsultorOpportunity, ConsultorResponse } from "./schemas";

export const LAVAFLOW_CONSULTOR_SYSTEM_PROMPT = `Voce e o Consultor LavaFlow IA, especialista em crescimento de lava-rapidos e estetica automotiva.
Sua missao e ajudar o proprietario a aumentar faturamento, retencao, recorrencia e eficiencia operacional.

Regras obrigatorias:
- Use apenas os dados fornecidos pelo sistema.
- Nunca invente numeros; todos os numeros devem vir do contexto agregado.
- Explique recomendacoes em linguagem simples.
- Priorize acoes de maior impacto financeiro.
- Fale como consultor de negocio, nao como chatbot generico.
- Sugira campanhas acionaveis e mensagens de WhatsApp prontas quando fizer sentido.
- Indique quando os dados ainda sao insuficientes.
- Separe dado real de estimativa usando termos como "potencial estimado", "pode ajudar a recuperar", "com base nos dados disponiveis" e "recomendo testar".
- Nunca prometa resultado garantido.`;

function statusFromScore(score: number): ConsultorResponse["diagnosis"]["status"] {
  if (score >= 80) return "excelente";
  if (score >= 60) return "bom";
  if (score >= 35) return "atencao";
  return "critico";
}

function makeOpportunity(input: Partial<ConsultorOpportunity> & Pick<ConsultorOpportunity, "id" | "category" | "title" | "description" | "recommendedAction" | "actionType">): ConsultorOpportunity {
  return {
    priority: "media",
    estimatedImpact: 0,
    whyItMatters: "Com base nos dados disponiveis, esta acao pode melhorar a recorrencia sem depender de novos cadastros.",
    ctaLabel: "Ver acao",
    whatsappMessage: null,
    ...input,
  };
}

const ORIGEM_LABELS: Record<string, string> = {
  CLIENTE_RECUPERADO: "clientes recuperados",
  FIDELIDADE: "programa de fidelidade",
  UPSELL_CHECKLIST: "upsells do checklist",
  CONSULTOR_IA: "Consultor IA",
  CAMPANHA: "campanhas",
  ANIVERSARIO: "aniversarios",
  LEVA_ETRAZ: "Leva e Traz",
};

function brl(value: number) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

function origemLabel(origem?: string | null) {
  return ORIGEM_LABELS[String(origem ?? "")] ?? String(origem ?? "origem registrada").toLowerCase();
}

export function buildRulesConsultorResponse(context: any, advancedUnavailable = false): ConsultorResponse & { fallbackNotice?: string } {
  const metrics = context.metrics ?? {};
  const opportunities = context.opportunities ?? {};
  const ticket = Number(context.derived?.ticket_para_estimativas ?? metrics.ticket_medio ?? 50);
  const inativosCount = Array.isArray(opportunities.clientes_inativos)
    ? opportunities.clientes_inativos.length
    : Number(metrics.clientes_inativos ?? 0);
  const healthScore = Number(metrics.health_score_calculado ?? 0);
  const indiceLavaFlow = Number(metrics.indice_lavaflow ?? healthScore);
  const topOpportunities: ConsultorOpportunity[] = [];

  if (indiceLavaFlow > 0 && indiceLavaFlow < 60) {
    const componentes = Array.isArray(metrics.indice_lavaflow_componentes) ? metrics.indice_lavaflow_componentes : [];
    const menor = componentes.slice().sort((a: any, b: any) => Number(a.score ?? 0) - Number(b.score ?? 0))[0];
    topOpportunities.push(makeOpportunity({
      id: "rules-indice-lavaflow",
      priority: indiceLavaFlow < 40 ? "alta" : "media",
      category: "operacao",
      title: `Indice LavaFlow em ${Math.round(indiceLavaFlow)}/100`,
      description: menor ? `${menor.label} esta puxando a nota para baixo (${menor.score}/100).` : "A nota geral indica espaco para melhorar crescimento e eficiencia.",
      estimatedImpact: 0,
      whyItMatters: "O indice combina operacao, recorrencia, upsell e receita influenciada em uma leitura executiva unica.",
      recommendedAction: menor ? `Priorizar uma acao para melhorar ${String(menor.label).toLowerCase()} nesta semana.` : "Revisar o Centro de Crescimento e escolher uma alavanca principal para a semana.",
      actionType: "relatorio",
      ctaLabel: "Ver Centro de Crescimento",
    }));
  }

  if (inativosCount > 0) {
    topOpportunities.push(makeOpportunity({
      id: "rules-retencao-inativos",
      priority: inativosCount >= 5 ? "alta" : "media",
      category: "retencao",
      title: `${inativosCount} clientes estao sem retornar`,
      description: `${inativosCount} clientes aparecem como inativos no periodo analisado.`,
      estimatedImpact: Math.round(inativosCount * ticket),
      whyItMatters: "Clientes inativos ja conhecem o negocio; recuperar parte deles costuma ser mais barato do que captar novos clientes.",
      recommendedAction: "Enviar uma campanha curta de retorno com convite para agendar ainda esta semana.",
      actionType: "whatsapp",
      ctaLabel: "Gerar mensagens",
      whatsappMessage: "Ola {nome}! Sentimos sua falta por aqui. Faz um tempo desde sua ultima visita e queremos te convidar para cuidar do seu veiculo novamente. Esta semana temos uma condicao especial para voce.",
    }));
  }

  if (Number(opportunities.clientes_com_recompensa ?? 0) > 0) {
    topOpportunities.push(makeOpportunity({
      id: "rules-fidelidade-recompensa",
      priority: "alta",
      category: "fidelidade",
      title: `${opportunities.clientes_com_recompensa} clientes podem resgatar recompensa`,
      description: "Ha clientes com pontos suficientes para receber um beneficio.",
      estimatedImpact: Math.round(Number(opportunities.clientes_com_recompensa) * ticket),
      whyItMatters: "Recompensa disponivel e um bom motivo para trazer o cliente de volta sem desconto agressivo.",
      recommendedAction: "Chamar esses clientes pelo WhatsApp e lembrar o beneficio disponivel.",
      actionType: "whatsapp",
      ctaLabel: "Gerar mensagens",
      whatsappMessage: "Ola {nome}! Boa noticia: voce ja possui pontos suficientes para resgatar {recompensa}. Esperamos voce para aproveitar seu beneficio.",
    }));
  }

  if (Number(opportunities.candidatos_assinatura ?? 0) > 0) {
    topOpportunities.push(makeOpportunity({
      id: "rules-assinatura-candidatos",
      priority: "media",
      category: "assinatura",
      title: `${opportunities.candidatos_assinatura} clientes podem assinar um plano`,
      description: "Clientes frequentes sem assinatura foram identificados nos ultimos 90 dias.",
      estimatedImpact: Math.round(Number(opportunities.candidatos_assinatura) * Math.max(ticket, Number(context.subscriptions?.mrr ?? 0) || ticket)),
      whyItMatters: "Assinaturas aumentam previsibilidade de caixa e recorrencia.",
      recommendedAction: "Oferecer o plano mensal mais simples para clientes com maior frequencia.",
      actionType: "assinatura",
      ctaLabel: "Ver assinaturas",
    }));
  }

  if (Number(opportunities.upsell_checklist_abertas ?? 0) > 0) {
    const topServico = Array.isArray(opportunities.upsell_checklist_por_servico)
      ? opportunities.upsell_checklist_por_servico[0]?.servico
      : null;
    topOpportunities.push(makeOpportunity({
      id: "rules-upsell-checklist",
      priority: "alta",
      category: "upsell",
      title: `${opportunities.upsell_checklist_abertas} oportunidades vindas do checklist`,
      description: topServico
        ? `O checklist identificou servicos adicionais, principalmente ${topServico}.`
        : "O checklist inicial identificou servicos adicionais que ainda podem ser oferecidos.",
      estimatedImpact: Math.round(Number(opportunities.upsell_checklist_potencial ?? 0)),
      whyItMatters: "Essas oportunidades aparecem durante a vistoria do veiculo, quando a necessidade esta clara e contextualizada.",
      recommendedAction: "Priorizar contato da recepcao com os clientes dessas OS e registrar aceite ou recusa.",
      actionType: "upsell",
      ctaLabel: "Ver ordens",
    }));
  }

  if (Number(opportunities.receita_influenciada_total ?? 0) > 0) {
    const topOrigem = Array.isArray(opportunities.receita_influenciada_por_origem)
      ? opportunities.receita_influenciada_por_origem[0]
      : null;
    const percentual = Number(opportunities.receita_influenciada_percentual ?? 0);
    topOpportunities.push(makeOpportunity({
      id: "rules-receita-influenciada",
      priority: "media",
      category: "relatorio",
      title: `LavaFlow influenciou ${brl(Number(opportunities.receita_influenciada_total))} no periodo`,
      description: topOrigem
        ? `A principal origem registrada foi ${origemLabel(topOrigem.origem)}, com ${brl(Number(topOrigem.valor ?? 0))}.`
        : "As funcionalidades do sistema ja possuem receita atribuida no periodo.",
      estimatedImpact: Math.round(Number(opportunities.receita_influenciada_total ?? 0)),
      whyItMatters: "Medir receita influenciada mostra quais rotinas realmente aumentam o faturamento.",
      recommendedAction: percentual > 0
        ? `Revisar as origens que ja representam ${(percentual * 100).toFixed(1)}% do faturamento do periodo e repetir as acoes com maior retorno.`
        : "Revisar o relatorio de Receita Influenciada e reforcar as origens com maior retorno.",
      actionType: "relatorio",
      ctaLabel: "Ver relatorios",
    }));
  }

  const receitaPorOrigem = Array.isArray(opportunities.receita_influenciada_por_origem)
    ? opportunities.receita_influenciada_por_origem
    : [];
  const receitaCampanhas = receitaPorOrigem.find((item: any) => item.origem === "CAMPANHA");
  if (Number(receitaCampanhas?.valor ?? 0) > 0) {
    topOpportunities.push(makeOpportunity({
      id: "rules-campanhas-conversao",
      priority: "alta",
      category: "retencao",
      title: `Campanhas geraram ${brl(Number(receitaCampanhas.valor))}`,
      description: `${Number(receitaCampanhas.quantidade ?? 0)} conversoes foram atribuidas a campanhas no periodo.`,
      estimatedImpact: Math.round(Number(receitaCampanhas.valor ?? 0)),
      whyItMatters: "Quando uma campanha vira ordem de servico, o LavaFlow consegue provar retorno financeiro direto, nao apenas envio de mensagens.",
      recommendedAction: "Duplicar o tipo de campanha com melhor retorno e manter o acompanhamento de conversoes atualizado.",
      actionType: "campanha",
      ctaLabel: "Ver campanhas",
    }));
  }

  if (Number(context.team?.comissao_total_pendente ?? 0) > 0) {
    topOpportunities.push(makeOpportunity({
      id: "rules-equipe-comissoes",
      priority: "baixa",
      category: "equipe",
      title: "Comissoes pendentes para revisar",
      description: `Ha R$ ${Number(context.team.comissao_total_pendente).toFixed(2)} em comissoes pendentes.`,
      estimatedImpact: 0,
      whyItMatters: "Comissao em dia ajuda previsibilidade da equipe e evita retrabalho financeiro.",
      recommendedAction: "Revisar e registrar o pagamento das comissoes pendentes.",
      actionType: "relatorio",
      ctaLabel: "Ver equipe",
    }));
  }

  const receitaInfluenciadaTotal = Number(opportunities.receita_influenciada_total ?? 0);
  const summary = topOpportunities.length
    ? receitaInfluenciadaTotal > 0
      ? `Hoje encontramos ${topOpportunities.length} oportunidades e ${brl(receitaInfluenciadaTotal)} ja atribuidos ao LavaFlow no periodo.`
      : `Hoje encontramos ${topOpportunities.length} oportunidades com potencial estimado de ${brl(Math.round(topOpportunities.reduce((sum, item) => sum + item.estimatedImpact, 0)))}.`
    : "Ainda nao tenho dados suficientes para uma analise confiavel. Recomendo registrar mais ordens de servico e clientes para melhorar minhas recomendacoes.";

  return {
    summary,
    healthScore,
    diagnosis: {
      status: statusFromScore(healthScore),
      strengths: [
        Number(metrics.lavagens_periodo ?? 0) > 0 ? `${metrics.lavagens_periodo} lavagens registradas no periodo.` : "Base pronta para capturar ordens e clientes.",
        Number(metrics.mrr ?? 0) > 0 ? `MRR atual de R$ ${Number(metrics.mrr).toFixed(2)}.` : "Ha espaco para criar receita recorrente.",
      ],
      risks: [
        inativosCount > 0 ? `${inativosCount} clientes aparecem como inativos.` : "Poucos sinais de risco com os dados atuais.",
      ],
    },
    topOpportunities: topOpportunities.slice(0, 6),
    weeklyActionPlan: [
      { day: "Segunda", action: "Chamar clientes inativos de maior gasto.", expectedResult: "Recuperar parte da receita estimada de retencao." },
      Number(receitaCampanhas?.valor ?? 0) > 0
        ? { day: "Terca", action: "Repetir a campanha que mais converteu e acompanhar novas OS atribuidas.", expectedResult: "Aumentar receita rastreavel de campanhas." }
        : { day: "Terca", action: "Oferecer assinatura para clientes frequentes.", expectedResult: "Criar novas conversas de recorrencia." },
      { day: "Quarta", action: "Divulgar servico de baixa adesao em dia fraco.", expectedResult: "Testar aumento de demanda no horario ocioso." },
    ],
    suggestedCampaigns: topOpportunities
      .filter((item) => item.whatsappMessage)
      .map((item) => ({
        name: item.title,
        audience: item.category,
        message: item.whatsappMessage ?? "",
        estimatedImpact: item.estimatedImpact,
      })),
    questionsToAskOwner: [
      "Qual meta de faturamento voce quer bater esta semana?",
      "Existe alguma promocao ativa que devo considerar nas recomendacoes?",
    ],
    fallbackNotice: advancedUnavailable
      ? "Consultor IA avancado indisponivel. Exibindo recomendacoes baseadas em regras."
      : undefined,
  };
}

export async function runConsultor(input: { context: unknown; question?: string }) {
  return generateStructuredConsultor({
    systemPrompt: LAVAFLOW_CONSULTOR_SYSTEM_PROMPT,
    businessContext: input.context,
    question: input.question,
  });
}
