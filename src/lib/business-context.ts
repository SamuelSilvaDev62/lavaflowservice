// Conhecimento do Negócio (client-safe): tipos, grupos, procedência e completude.
// Nunca armazenar segredos/API keys nesse objeto.

export type BusinessContext = {
  // Identidade & Posicionamento
  descricao?: string | null;
  posicionamento?: string | null;
  slogan_promessa?: string | null;
  // Público & Diferenciais
  publico_alvo?: string | null;
  perfil_cliente_ideal?: string | null;
  diferenciais?: string | null;
  especialidades?: string | null;
  servicos_destaque?: string | null;
  // Região & Atendimento
  cidade?: string | null;
  estado?: string | null;
  bairros_atendidos?: string | null;
  cidades_atendidas?: string | null;
  area_atendimento?: string | null;
  raio_atendimento_km?: string | null;
  observacoes_regionais?: string | null;
  referencias_locais?: string | null;
  concorrentes?: string | null;
  // Presença Digital (apenas referências cadastradas — sem leitura automática)
  google_business_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  website_url?: string | null;
  outras_referencias?: string | null;
  // Regras Comerciais
  tom_de_voz?: string | null;
  objetivos_marketing?: string | null;
  politica_descontos?: string | null;
  restricoes_campanhas?: string | null;
  restricoes_comunicacao?: string | null;
  // Extensibilidade: campos futuros continuam preservados no jsonb.
  [key: string]: unknown;
};

export const TONS_DE_VOZ = [
  "Próximo e informal",
  "Profissional e direto",
  "Premium e sofisticado",
  "Divertido e descontraído",
] as const;

export type BusinessContextFieldKey = keyof BusinessContext & string;

export type BusinessContextGroupId =
  | "identidade"
  | "publico"
  | "regiao"
  | "digital"
  | "comercial";

export type BusinessContextField = {
  key: BusinessContextFieldKey;
  label: string;
  placeholder: string;
  long?: boolean;
  peso: number;
  grupo: BusinessContextGroupId;
  ajuda?: string;
};

export const BUSINESS_CONTEXT_GROUPS: Array<{
  id: BusinessContextGroupId;
  titulo: string;
  porque: string;
}> = [
  {
    id: "identidade",
    titulo: "Identidade & Posicionamento",
    porque: "Define como o LavaFlow descreve sua empresa em recomendações e mensagens.",
  },
  {
    id: "publico",
    titulo: "Público & Diferenciais",
    porque: "Ajuda a escolher para quem falar e qual argumento usar em cada campanha.",
  },
  {
    id: "regiao",
    titulo: "Região & Atendimento",
    porque: "Permite mensagens com referências locais reais e limites de atendimento corretos.",
  },
  {
    id: "digital",
    titulo: "Presença Digital",
    porque: "Registra suas referências online. Servem de contexto — não há leitura automática.",
  },
  {
    id: "comercial",
    titulo: "Regras Comerciais",
    porque: "Garante que sugestões respeitem seu tom, objetivos, descontos e restrições.",
  },
];

export const BUSINESS_CONTEXT_FIELDS: BusinessContextField[] = [
  { key: "descricao", label: "Descrição / história do negócio", placeholder: "Como o lava-rápido começou, o que ele é hoje…", long: true, peso: 2, grupo: "identidade" },
  { key: "posicionamento", label: "Posicionamento", placeholder: "Ex.: lava-rápido premium com atendimento agendado", long: true, peso: 2, grupo: "identidade" },
  { key: "slogan_promessa", label: "Slogan / promessa principal", placeholder: "Ex.: Seu carro limpo sem sair do escritório", peso: 1, grupo: "identidade" },

  { key: "publico_alvo", label: "Público-alvo", placeholder: "Ex.: motoristas de app, frotas, famílias do bairro", long: true, peso: 2, grupo: "publico" },
  { key: "perfil_cliente_ideal", label: "Perfil de cliente ideal", placeholder: "Ex.: cliente recorrente, carro próprio, agenda semanal", long: true, peso: 1, grupo: "publico" },
  { key: "diferenciais", label: "Diferenciais", placeholder: "Ex.: leva e traz, produtos importados, café na espera", long: true, peso: 2, grupo: "publico" },
  { key: "especialidades", label: "Especialidades técnicas", placeholder: "Ex.: vitrificação, higienização interna, polimento", peso: 1, grupo: "publico" },
  { key: "servicos_destaque", label: "Serviços que você quer destacar", placeholder: "Ex.: Lavagem completa e Vitrificação", peso: 1, grupo: "publico", ajuda: "Posicionamento comercial — os preços continuam vindo do cadastro de serviços." },

  { key: "cidade", label: "Cidade", placeholder: "Ex.: Campinas", peso: 1, grupo: "regiao" },
  { key: "estado", label: "Estado (UF)", placeholder: "Ex.: SP", peso: 1, grupo: "regiao" },
  { key: "bairros_atendidos", label: "Bairros atendidos", placeholder: "Ex.: Cambuí, Taquaral, Centro", peso: 1, grupo: "regiao" },
  { key: "cidades_atendidas", label: "Outras cidades atendidas", placeholder: "Ex.: Valinhos, Vinhedo", peso: 1, grupo: "regiao" },
  { key: "area_atendimento", label: "Área de atendimento", placeholder: "Ex.: atendimento na loja + leva e traz na zona sul", peso: 1, grupo: "regiao" },
  { key: "raio_atendimento_km", label: "Raio de atendimento (km)", placeholder: "Ex.: 12", peso: 1, grupo: "regiao" },
  { key: "referencias_locais", label: "Referências locais", placeholder: "Ex.: ao lado do Shopping Iguatemi", peso: 1, grupo: "regiao" },
  { key: "observacoes_regionais", label: "Observações regionais", placeholder: "Ex.: muita poeira no verão, chuva forte em janeiro", long: true, peso: 1, grupo: "regiao" },
  { key: "concorrentes", label: "Referências / concorrentes", placeholder: "Nomes de negócios que você usa como referência", peso: 1, grupo: "regiao" },

  { key: "google_business_url", label: "Google Business Profile (URL)", placeholder: "https://…", peso: 1, grupo: "digital" },
  { key: "instagram_url", label: "Instagram (URL)", placeholder: "https://instagram.com/…", peso: 1, grupo: "digital" },
  { key: "facebook_url", label: "Facebook (URL)", placeholder: "https://facebook.com/…", peso: 1, grupo: "digital" },
  { key: "tiktok_url", label: "TikTok (URL)", placeholder: "https://tiktok.com/@…", peso: 1, grupo: "digital" },
  { key: "website_url", label: "Website (URL)", placeholder: "https://…", peso: 1, grupo: "digital" },
  { key: "outras_referencias", label: "Outras referências", placeholder: "Qualquer informação extra que a IA deva conhecer", long: true, peso: 1, grupo: "digital" },

  { key: "objetivos_marketing", label: "Objetivos de marketing", placeholder: "Ex.: aumentar recorrência e vender planos mensais", long: true, peso: 1, grupo: "comercial" },
  { key: "politica_descontos", label: "Política de descontos", placeholder: "Ex.: no máximo 10%, nunca em vitrificação", long: true, peso: 1, grupo: "comercial" },
  { key: "restricoes_campanhas", label: "Restrições de campanhas", placeholder: "Ex.: não enviar mensagem à noite", long: true, peso: 1, grupo: "comercial" },
  { key: "restricoes_comunicacao", label: "Restrições de comunicação", placeholder: "Ex.: não usar gírias, não prometer prazo fixo", long: true, peso: 1, grupo: "comercial" },
];

export function fieldsByGroup(grupo: BusinessContextGroupId) {
  return BUSINESS_CONTEXT_FIELDS.filter((f) => f.grupo === grupo);
}

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

/** Completude por grupo, para orientar o preenchimento. */
export function groupCompleteness(
  ctx: BusinessContext | null | undefined,
  grupo: BusinessContextGroupId,
): { preenchidos: number; total: number } {
  const campos = fieldsByGroup(grupo);
  return {
    preenchidos: campos.filter((f) => preenchido(ctx?.[f.key])).length,
    total: campos.length,
  };
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

// ---------------------------------------------------------------------------
// Procedência / confiança — fundação leve e extensível.
// Hoje todo conhecimento é "explicit". "observed"/"inferred" ficam preparados
// para quando existirem integrações reais ou derivação por IA.
// ---------------------------------------------------------------------------

export type KnowledgeOrigin = "explicit" | "observed" | "inferred";

export type KnowledgeFact<T = string> = {
  key: string;
  value: T;
  origin: KnowledgeOrigin;
  /** Fonte legível: "cadastro", "operacao", "google_business", etc. */
  source: string;
  /** 0–1. Conhecimento explícito do proprietário vale 1. */
  confidence: number;
  updatedAt?: string | null;
};

export function explicitFact<T>(key: string, value: T, source = "cadastro"): KnowledgeFact<T> {
  return { key, value, origin: "explicit", source, confidence: 1, updatedAt: null };
}

/** Converte o BusinessContext preenchido em fatos com procedência. */
export function businessContextFacts(
  ctx: BusinessContext | null | undefined,
  atualizadoEm?: string | null,
): KnowledgeFact[] {
  const out: KnowledgeFact[] = [];
  for (const f of BUSINESS_CONTEXT_FIELDS) {
    const v = ctx?.[f.key];
    if (!preenchido(v)) continue;
    out.push({ ...explicitFact(f.key, String(v)), updatedAt: atualizadoEm ?? null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fontes de conhecimento (estado exibido na aba Presença Digital).
// ---------------------------------------------------------------------------

export type KnowledgeSourceState = "ativo" | "referencia" | "nao_informado";

export type KnowledgeSource = {
  id: string;
  nome: string;
  estado: KnowledgeSourceState;
  origin: KnowledgeOrigin;
  detalhe?: string | null;
};

export const KNOWLEDGE_SOURCE_LABEL: Record<KnowledgeSourceState, string> = {
  ativo: "Ativo",
  referencia: "Referência cadastrada",
  nao_informado: "Não informado",
};

/** Lista determinística das fontes e seus estados. Nada é "conectado" ou "sincronizado". */
export function knowledgeSources(
  ctx: BusinessContext | null | undefined,
  opts: { temHistorico?: boolean } = {},
): KnowledgeSource[] {
  const c = ctx ?? {};
  const ref = (v: unknown): KnowledgeSourceState => (preenchido(v) ? "referencia" : "nao_informado");
  return [
    { id: "lavaflow", nome: "Dados LavaFlow", estado: "ativo", origin: "explicit", detalhe: "Cadastro da empresa, serviços e configurações." },
    {
      id: "operacao",
      nome: "Histórico de clientes/operação",
      estado: opts.temHistorico ? "ativo" : "nao_informado",
      origin: "observed",
      detalhe: opts.temHistorico ? "Ordens, agendamentos e clientes registrados." : "Ainda sem histórico suficiente.",
    },
    { id: "google_business", nome: "Google Business Profile", estado: ref(c.google_business_url), origin: "explicit" },
    { id: "instagram", nome: "Instagram", estado: ref(c.instagram_url), origin: "explicit" },
    { id: "facebook", nome: "Facebook", estado: ref(c.facebook_url), origin: "explicit" },
    { id: "tiktok", nome: "TikTok", estado: ref(c.tiktok_url), origin: "explicit" },
    { id: "website", nome: "Website", estado: ref(c.website_url), origin: "explicit" },
  ];
}
