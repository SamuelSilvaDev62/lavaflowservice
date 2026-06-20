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

export function buildRulesConsultorResponse(context: any, advancedUnavailable = false): ConsultorResponse & { fallbackNotice?: string } {
  const metrics = context.metrics ?? {};
  const opportunities = context.opportunities ?? {};
  const ticket = Number(context.derived?.ticket_para_estimativas ?? metrics.ticket_medio ?? 50);
  const inativosCount = Array.isArray(opportunities.clientes_inativos)
    ? opportunities.clientes_inativos.length
    : Number(metrics.clientes_inativos ?? 0);
  const healthScore = Number(metrics.health_score_calculado ?? 0);
  const topOpportunities: ConsultorOpportunity[] = [];

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

  const summary = topOpportunities.length
    ? `Hoje encontramos ${topOpportunities.length} oportunidades com potencial estimado de R$ ${Math.round(topOpportunities.reduce((sum, item) => sum + item.estimatedImpact, 0))}.`
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
      { day: "Terca", action: "Oferecer assinatura para clientes frequentes.", expectedResult: "Criar novas conversas de recorrencia." },
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
