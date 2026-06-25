/**
 * LavaFlow — Design Language v2.1
 * Tokens canônicos consumidos por componentes (motion, surfaces, slots).
 * Cores e radius vivem em src/styles.css; aqui ficam constantes JS/TS
 * (durações, easings, mensagens default) compartilhadas entre componentes.
 *
 * NUNCA hardcode cor/radius — sempre usar tokens semânticos do CSS.
 */

export const motion = {
  duration: {
    /** Micro feedbacks (press, ripple). */
    fast: 150,
    /** Padrão (hover, transição de estado). */
    base: 200,
    /** Lift / modais / page transition. */
    slow: 250,
    /** Apenas animações de entrada de conteúdo (skeleton -> data). */
    entrance: 320,
  },
  easing: {
    standard: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    decel: "cubic-bezier(0, 0, 0.2, 1)",
    accel: "cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

export const surface = {
  raised: "shadow-[var(--shadow-neo)]",
  raisedSm: "shadow-[var(--shadow-neo-sm)]",
  inset: "shadow-[var(--shadow-neo-inset)]",
  hover: "shadow-[var(--shadow-neo-hover)]",
} as const;

export const minTouchTargetPx = 44;

/** Saudação dinâmica por horário (America/Sao_Paulo aware). */
export function greetingForNow(now: Date = new Date()): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = now.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Tom de voz do Consultor Inteligente: claro, direto, com 1 ação sugerida. */
export const consultorTone = {
  greetingPrefix: "Aqui está o que eu observei:",
  fallbackEmpty: "Ainda não há dados suficientes para uma análise — vamos cadastrar os primeiros clientes?",
  ctaLabel: "Aplicar sugestão",
} as const;
