import type { OpenSquadTaskRequest, OpenSquadTaskResult } from "./types";

function estimateTokens(payload: unknown) {
  return Math.ceil(JSON.stringify(payload).length / 4);
}

function fallbackOutput(request: OpenSquadTaskRequest) {
  if (request.taskKey === "generate_inactive_clients_campaign") {
    const total = Number(request.context.audience?.total ?? 0);
    return {
      campaignTitle: "Convite para voltar esta semana",
      targetAudience: `${total} clientes sem visita recente`,
      whatsappMessage: "Ola {nome}! Sentimos sua falta por aqui. Esta semana temos horarios disponiveis para cuidar do seu veiculo com carinho. Quer reservar seu horario?",
      instagramCaption: "Semana perfeita para deixar o carro em dia. Chame no WhatsApp e garanta seu horario.",
      suggestedOffer: "Beneficio leve para retorno: 10% off em servico complementar ou pontos extras.",
      cta: "Agendar agora",
      estimatedImpact: request.context.estimatedImpact ?? "A calcular",
      notes: "Gerado em modo seguro com dados resumidos do LavaFlow.",
    };
  }

  if (request.taskKey === "generate_revenue_diagnosis") {
    const metrics = request.context.metrics ?? {};
    const delta = Number(metrics.previousRevenue ?? 0) > 0
      ? (Number(metrics.currentRevenue ?? 0) - Number(metrics.previousRevenue ?? 0)) / Number(metrics.previousRevenue)
      : 0;
    return {
      summary: delta < 0 ? "O faturamento caiu contra o periodo anterior e merece acao comercial." : "O faturamento esta estavel ou em crescimento.",
      mainProblems: delta < -0.1 ? ["Queda de receita no periodo", "Possivel reducao de recorrencia"] : ["Poucos sinais criticos no periodo"],
      opportunities: ["Recuperar clientes inativos", "Divulgar servicos de maior ticket", "Preencher horarios fracos"],
      recommendedActions: ["Criar campanha para clientes inativos", "Revisar servicos com queda", "Acompanhar ocupacao da semana"],
      priority: delta < -0.25 ? "high" : delta < -0.1 ? "medium" : "low",
    };
  }

  return {
    headline: "Resumo do dia preparado",
    summary: "Os dados do dia foram consolidados. Use as oportunidades abertas para decidir a proxima acao.",
    positivePoints: ["Indicadores operacionais calculados sem IA para reduzir custo"],
    attentionPoints: ["Acompanhar clientes inativos e ocupacao da agenda"],
    tomorrowSuggestions: ["Revisar agenda cedo", "Priorizar clientes com maior chance de retorno"],
  };
}

export async function executeOpenSquadTask(request: OpenSquadTaskRequest): Promise<OpenSquadTaskResult> {
  const started = Date.now();
  const apiUrl = typeof process !== "undefined" ? process.env.OPENSQUAD_API_URL : undefined;
  const apiKey = typeof process !== "undefined" ? process.env.OPENSQUAD_API_KEY : undefined;

  if (!apiUrl || !apiKey) {
    const output = fallbackOutput(request);
    return {
      success: true,
      output,
      tokensUsed: estimateTokens({ request, output }),
      modelUsed: "local-fallback",
      executionTimeMs: Date.now() - started,
    };
  }

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/tasks/execute`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    });
    const output = await response.json();
    if (!response.ok) {
      return {
        success: false,
        output: null,
        error: output?.error ?? "Falha ao executar inteligencia externa.",
        executionTimeMs: Date.now() - started,
      };
    }
    return {
      success: true,
      output,
      tokensUsed: Number(output?.tokensUsed ?? estimateTokens({ request, output })),
      modelUsed: output?.modelUsed ?? "opensquad",
      executionTimeMs: Date.now() - started,
    };
  } catch (error) {
    const output = fallbackOutput(request);
    return {
      success: true,
      output,
      tokensUsed: estimateTokens({ request, output }),
      modelUsed: "local-fallback",
      executionTimeMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Falha ao acessar inteligencia externa.",
    };
  }
}
