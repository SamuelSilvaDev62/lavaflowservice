export type ConsultorOpportunity = {
  id: string;
  priority: "alta" | "media" | "baixa";
  category: "retencao" | "fidelidade" | "assinatura" | "upsell" | "agenda" | "equipe" | "financeiro";
  title: string;
  description: string;
  estimatedImpact: number;
  whyItMatters: string;
  recommendedAction: string;
  actionType: "whatsapp" | "campanha" | "assinatura" | "agendamento" | "relatorio" | "configuracao";
  ctaLabel: string;
  whatsappMessage: string | null;
};

export type ConsultorResponse = {
  summary: string;
  healthScore: number;
  diagnosis: {
    status: "excelente" | "bom" | "atencao" | "critico";
    strengths: string[];
    risks: string[];
  };
  topOpportunities: ConsultorOpportunity[];
  weeklyActionPlan: Array<{ day: string; action: string; expectedResult: string }>;
  suggestedCampaigns: Array<{ name: string; audience: string; message: string; estimatedImpact: number }>;
  questionsToAskOwner: string[];
};

export const LAVAFLOW_CONSULTOR_SYSTEM_PROMPT = `Voce e o Consultor LavaFlow IA, especialista em crescimento de lava-rapidos e estetica automotiva.
Sua missao e ajudar o proprietario a aumentar faturamento, retencao, recorrencia e eficiencia operacional.

Regras obrigatorias:
- Use apenas os dados fornecidos pelo sistema ou pelas ferramentas server-side.
- Nunca invente numeros.
- Explique recomendacoes em linguagem simples e objetiva.
- Priorize acoes de maior impacto financeiro e menor esforco.
- Fale como consultor de negocio, nao como chatbot generico.
- Sugira campanhas acionaveis e mensagens de WhatsApp quando fizer sentido.
- Diga claramente quando os dados forem insuficientes.
- Separe dado real de estimativa usando termos como "potencial estimado", "pode ajudar" e "recomendo testar".
- Nunca prometa resultado garantido.
- Nunca exponha IDs internos, tokens, chaves ou telefone completo.`;

function statusFromScore(score: number): ConsultorResponse["diagnosis"]["status"] {
  if (score >= 80) return "excelente";
  if (score >= 60) return "bom";
  if (score >= 35) return "atencao";
  return "critico";
}

function makeOpportunity(
  input: Partial<ConsultorOpportunity> &
    Pick<ConsultorOpportunity, "id" | "category" | "title" | "description" | "recommendedAction" | "actionType">,
): ConsultorOpportunity {
  return {
    priority: "media",
    estimatedImpact: 0,
    whyItMatters: "Com base nos dados disponiveis, esta acao pode melhorar a recorrencia sem depender de novos cadastros.",
    ctaLabel: "Ver acao",
    whatsappMessage: null,
    ...input,
  };
}

export function buildRulesConsultorResponse(context: any): ConsultorResponse {
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
      ctaLabel: "Criar abordagem",
      whatsappMessage: "Ola {nome}! Sentimos sua falta por aqui. Faz um tempo desde sua ultima visita e queremos te convidar para cuidar do seu veiculo novamente. Que tal reservar um horario esta semana?",
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
      ctaLabel: "Criar abordagem",
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
      recommendedAction: "Oferecer o plano mensal mais simples aos clientes de maior frequencia.",
      actionType: "assinatura",
      ctaLabel: "Planejar oferta",
    }));
  }

  const diasFracos = Array.isArray(opportunities.dias_fracos) ? opportunities.dias_fracos : [];
  if (diasFracos[0]?.dia) {
    topOpportunities.push(makeOpportunity({
      id: "rules-agenda-dia-fraco",
      priority: "media",
      category: "agenda",
      title: `${diasFracos[0].dia} aparece como um dia fraco`,
      description: "A receita registrada nesse dia da semana ficou entre as menores do periodo.",
      estimatedImpact: Math.round(ticket * 2),
      whyItMatters: "Ocupar horarios historicamente fracos pode aumentar faturamento sem pressionar os picos da operacao.",
      recommendedAction: `Testar uma campanha curta ou beneficio de agenda para ${diasFracos[0].dia}.`,
      actionType: "campanha",
      ctaLabel: "Planejar campanha",
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
      ctaLabel: "Revisar equipe",
    }));
  }

  const potential = Math.round(topOpportunities.reduce((sum, item) => sum + item.estimatedImpact, 0));
  const summary = topOpportunities.length
    ? `Encontramos ${topOpportunities.length} frentes de acao com potencial estimado combinado de R$ ${potential}.`
    : "Ainda nao ha dados suficientes para uma analise confiavel. Continue registrando ordens, clientes e agendamentos para melhorar as recomendacoes.";

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
      { day: "Dia 1", action: "Atacar a oportunidade de maior prioridade.", expectedResult: "Gerar conversas comerciais com base em clientes ja conhecidos." },
      { day: "Dia 2", action: "Revisar clientes frequentes sem assinatura.", expectedResult: "Abrir oportunidades de receita recorrente." },
      { day: "Dia 3", action: "Testar demanda em um dia ou horario historicamente fraco.", expectedResult: "Distribuir melhor a ocupacao da agenda." },
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
      "Como aumentar meu faturamento esta semana?",
      "Quais clientes devo priorizar hoje?",
      "Onde estou deixando dinheiro na mesa?",
      "Que acao eu consigo executar ainda hoje?",
    ],
  };
}
