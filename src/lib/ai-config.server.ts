// Configuração do modelo de IA (server-only). Nunca exposta ao cliente.

/** Modelo padrão validado no Lovable AI Gateway. */
const DEFAULT_AI_MODEL = "google/gemini-3.5-flash";

/** Modelos permitidos (allowlist do gateway). Evita ID inválido em produção. */
const ALLOWED_AI_MODELS = new Set([
  "google/gemini-3.5-flash",
  "google/gemini-3-pro-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
]);

/** Model ID efetivo: `LOVABLE_AI_MODEL` quando válido, senão o padrão estável. */
export function getAiModelId(): string {
  const configured = process.env["LOVABLE_AI_MODEL"]?.trim();
  if (configured && ALLOWED_AI_MODELS.has(configured)) return configured;
  if (configured) {
    console.warn(`[ai-config] LOVABLE_AI_MODEL inválido ("${configured}"), usando ${DEFAULT_AI_MODEL}`);
  }
  return DEFAULT_AI_MODEL;
}
