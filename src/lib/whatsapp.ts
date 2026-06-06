import { onlyDigits } from "./format";

export type WhatsAppTemplateKey =
  | "reativacao_30"
  | "reativacao_45"
  | "reativacao_60"
  | "reativacao_90"
  | "pronto_para_retirada"
  | "agradecimento"
  | "aniversario"
  | "convite_assinatura";

const DEFAULTS: Record<WhatsAppTemplateKey, string> = {
  reativacao_30: "Olá {{nome}}! Faz 30 dias desde sua última lavagem. Que tal renovar o brilho? 🚗✨",
  reativacao_45: "Oi {{nome}}, sentimos sua falta! Reserve um horário e ganhe um agrado especial.",
  reativacao_60: "{{nome}}, faz 60 dias. Liberamos um cupom exclusivo só pra você voltar. 🎁",
  reativacao_90: "{{nome}}, queremos você de volta! Lavagem com desconto especial esta semana.",
  pronto_para_retirada: "Olá {{nome}}, seu veículo {{placa}} está pronto para retirada! 🚙",
  agradecimento: "Obrigado pela confiança, {{nome}}! Avalie nossa lavagem e ajude a melhorar. ⭐",
  aniversario: "Feliz aniversário, {{nome}}! 🎂 Presente da casa: lavagem cortesia este mês.",
  convite_assinatura: "{{nome}}, descubra nosso plano mensal e economize até 40% nas lavagens.",
};

const STORAGE_KEY = "lavaflow_wa_templates";

export function getTemplate(key: WhatsAppTemplateKey): string {
  if (typeof window === "undefined") return DEFAULTS[key];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Partial<Record<WhatsAppTemplateKey, string>>) : {};
    return map[key] ?? DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
}

export function setTemplate(key: WhatsAppTemplateKey, text: string) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(STORAGE_KEY);
  const map = raw ? JSON.parse(raw) : {};
  map[key] = text;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function allTemplates() {
  return (Object.keys(DEFAULTS) as WhatsAppTemplateKey[]).map((k) => ({
    key: k,
    label: k,
    value: getTemplate(k),
    default: DEFAULTS[k],
  }));
}

export function renderTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export function waLink(phone: string, message: string) {
  const num = onlyDigits(phone);
  const withCountry = num.length <= 11 ? `55${num}` : num;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}
