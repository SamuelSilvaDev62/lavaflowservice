import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { consultorJsonSchema, consultorResponseSchema, type ConsultorResponse } from "./schemas";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function hasOpenAIConfig() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function createOpenAIProvider() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  return createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const texts = (payload?.output ?? [])
    .flatMap((item: any) => item?.content ?? [])
    .map((content: any) => content?.text ?? content?.json)
    .filter(Boolean);
  return texts[0] ? (typeof texts[0] === "string" ? texts[0] : JSON.stringify(texts[0])) : "";
}

export async function generateStructuredConsultor(input: {
  systemPrompt: string;
  businessContext: unknown;
  question?: string;
}): Promise<{ data: ConsultorResponse; usage: { inputTokens: number; outputTokens: number } }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      input: [
        { role: "system", content: input.systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            pergunta: input.question ?? "Gere um diagnostico priorizado do negocio.",
            contexto_agregado: input.businessContext,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "lavaflow_consultor_response",
          strict: true,
          schema: consultorJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI retornou ${response.status}: ${text.slice(0, 240)}`);
  }

  const payload = await response.json();
  const raw = extractResponseText(payload);
  const parsed = consultorResponseSchema.parse(JSON.parse(raw));
  return {
    data: parsed,
    usage: {
      inputTokens: Number(payload?.usage?.input_tokens ?? payload?.usage?.prompt_tokens ?? 0),
      outputTokens: Number(payload?.usage?.output_tokens ?? payload?.usage?.completion_tokens ?? 0),
    },
  };
}
