// Contexto do Negócio (client-safe): tipos, defaults e cálculo de completude.
// Nunca armazenar segredos/API keys nesse objeto.

export type BusinessContext = {
  descricao?: string | null;
  posicionamento?: string | null;
  publico_alvo?: string | null;
  diferenciais?: string | null;
  tom_de_voz?: string | null;
  objetivos_marketing?: string | null;
  restricoes_campanhas?: string | null;
  cidade?: string | null;
  estado?: string | null;
  bairros_atendidos?: string | null;
  concorrentes?: string | null;
  google_business_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  website_url?: string | null;
  outras_referencias?: string | null;
  // Extensibilidade: campos futuros continuam preservados no jsonb.
  [key: string]: unknown;
};

export const TONS_DE_VOZ = [
  "Próximo e informal",
  "Profissional e direto",
  "Premium e sofisticado",
  "Divertido e descontraído",
] as const;

export const BUSINESS_CONTEXT_FIELDS: Array<{
  key: keyof BusinessContext & string;
  label: string;
  placeholder: string;
  long?: boolean;
  peso: number;
}> = [
  { key: "descricao", label: "Descrição / história do negócio", placeholder: "Como o lava-rápido começou, o que ele é hoje…", long: true, peso: 2 },
  { key: "posicionamento", label: "Posicionamento", placeholder: "Ex.: lava-rápido premium com atendimento agendado", long: true, peso: 2 },
  { key: "publico_alvo", label: "Público-alvo", placeholder: "Ex.: motoristas de app, frotas, famílias do bairro", long: true, peso: 2 },
  { key: "diferenciais", label: "Diferenciais", placeholder: "Ex.: leva e traz, produtos importados, café na espera", long: true, peso: 2 },
  { key: "objetivos_marketing", label: "Objetivos de marketing", placeholder: "Ex.: aumentar recorrência e vender planos mensais", long: true, peso: 1 },
  { key: "restricoes_campanhas", label: "Restrições / preferências de campanhas", placeholder: "Ex.: não dar desconto acima de 10%, não enviar mensagem à noite", long: true, peso: 1 },
  { key: "cidade", label: "Cidade", placeholder: "Ex.: Campinas", peso: 1 },
  { key: "estado", label: "Estado (UF)", placeholder: "Ex.: SP", peso: 1 },
  { key: "bairros_atendidos", label: "Bairros / região atendida", placeholder: "Ex.: Cambuí, Taquaral, Centro", peso: 1 },
  { key: "concorrentes", label: "Referências / concorrentes", placeholder: "Nomes de negócios que você usa como referência", peso: 1 },
  { key: "google_business_url", label: "Google Business Profile (URL)", placeholder: "https://…", peso: 1 },
  { key: "instagram_url", label: "Instagram (URL)", placeholder: "https://instagram.com/…", peso: 1 },
  { key: "facebook_url", label: "Facebook (URL)", placeholder: "https://facebook.com/…", peso: 1 },
  { key: "tiktok_url", label: "TikTok (URL)", placeholder: "https://tiktok.com/@…", peso: 1 },
  { key: "website_url", label: "Website (URL)", placeholder: "https://…", peso: 1 },
  { key: "outras_referencias", label: "Outras referências", placeholder: "Qualquer informação extra que a IA deva conhecer", long: true, peso: 1 },
];

function preenchido(v: unknown) {
  return typeof v === "string" ? v.trim().length > 1 : v != null;
}

/** Completude 0–100 considerando o contexto + dados já vindos da empresa. */
export function businessContextCompleteness(
  ctx: BusinessContext | null | undefined,
  tom?: string | null,
): number {
  const total = BUSINESS_CONTEXT_FIELDS.reduce((s, f) => s + f.peso, 0) + 1;
  let feito = preenchido(tom) ? 1 : 0;
  for (const f of BUSINESS_CONTEXT_FIELDS) {
    if (preenchido(ctx?.[f.key])) feito += f.peso;
  }
  return Math.min(100, Math.round((feito / total) * 100));
}

type EmpresaLike = {
  nome_fantasia?: string | null;
  endereco?: string | null;
  horario_funcionamento?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  whatsapp?: string | null;
} | null;

/** Fatos reais do perfil para a prévia "O LavaFlow sabe que…". */
export function businessContextFatos(
  ctx: BusinessContext | null | undefined,
  empresa: EmpresaLike,
  tom?: string | null,
): string[] {
  const fatos: string[] = [];
  const c = ctx ?? {};
  if (empresa?.nome_fantasia) fatos.push(`o estabelecimento se chama ${empresa.nome_fantasia}.`);
  const local = [c.cidade, c.estado].filter(Boolean).join(" - ");
  if (local) fatos.push(`você atende em ${local}${c.bairros_atendidos ? ` (${c.bairros_atendidos})` : ""}.`);
  else if (empresa?.endereco) fatos.push(`o endereço cadastrado é ${empresa.endereco}.`);
  if (c.publico_alvo) fatos.push(`seu público principal é ${String(c.publico_alvo).toLowerCase()}.`);
  if (c.diferenciais) fatos.push(`seus diferenciais incluem ${String(c.diferenciais).toLowerCase()}.`);
  if (c.posicionamento) fatos.push(`seu posicionamento é ${String(c.posicionamento).toLowerCase()}.`);
  if (tom) fatos.push(`a comunicação deve usar um tom ${tom.toLowerCase()}.`);
  if (c.objetivos_marketing) fatos.push(`sua prioridade de marketing é ${String(c.objetivos_marketing).toLowerCase()}.`);
  if (empresa?.horario_funcionamento) fatos.push(`o horário de funcionamento é ${empresa.horario_funcionamento}.`);
  return fatos.slice(0, 6);
}

/** Contexto efetivo: junta o que já existe em `empresa` com o preenchido manualmente. */
export function mergeEmpresaIntoContext(
  ctx: BusinessContext | null | undefined,
  empresa: EmpresaLike,
): BusinessContext {
  const c: BusinessContext = { ...(ctx ?? {}) };
  if (!c.instagram_url && empresa?.instagram) c.instagram_url = empresa.instagram;
  if (!c.facebook_url && empresa?.facebook) c.facebook_url = empresa.facebook;
  if (!c.website_url && empresa?.website) c.website_url = empresa.website;
  return c;
}
