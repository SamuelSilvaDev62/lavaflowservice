// Pacotes compactos de contexto por Skill (determinísticos, sem IA).
// Objetivo: evitar enviar o negócio inteiro ao LLM em cada chamada.

import type { BusinessContext } from "@/lib/business-context";

export type SkillId = "recovery" | "morning_brief" | "campaign";

export type SkillContextPack = {
  skill: SkillId;
  identidade: Record<string, string>;
  regras: Record<string, string>;
  operacional?: Record<string, number | string>;
  servicosRelevantes?: Array<{ nome: string; preco: number }>;
  /** Campos do preset que ainda não foram preenchidos pelo proprietário. */
  faltando: string[];
};

type EmpresaLike = {
  nome_fantasia?: string | null;
  endereco?: string | null;
  horario_funcionamento?: string | null;
  whatsapp?: string | null;
} | null;

export type SkillContextInput = {
  contexto: BusinessContext | null | undefined;
  empresa?: EmpresaLike;
  tom?: string | null;
  servicos?: Array<{ nome: string; preco: number }>;
  operacional?: Record<string, number | string>;
};

/** Campos usados por cada preset (chaves do BusinessContext). */
export const SKILL_PRESETS: Record<SkillId, { identidade: string[]; regras: string[] }> = {
  recovery: {
    identidade: ["posicionamento", "diferenciais", "cidade", "estado", "bairros_atendidos", "referencias_locais"],
    regras: ["politica_descontos", "restricoes_campanhas", "restricoes_comunicacao"],
  },
  morning_brief: {
    identidade: ["posicionamento", "area_atendimento", "cidade", "estado"],
    regras: ["objetivos_marketing", "restricoes_comunicacao"],
  },
  campaign: {
    identidade: [
      "slogan_promessa",
      "posicionamento",
      "publico_alvo",
      "perfil_cliente_ideal",
      "diferenciais",
      "especialidades",
      "servicos_destaque",
      "cidade",
      "estado",
      "bairros_atendidos",
      "cidades_atendidas",
      "observacoes_regionais",
    ],
    regras: ["objetivos_marketing", "politica_descontos", "restricoes_campanhas", "restricoes_comunicacao"],
  },
};

function pick(ctx: BusinessContext | null | undefined, keys: string[]) {
  const out: Record<string, string> = {};
  const faltando: string[] = [];
  for (const k of keys) {
    const v = ctx?.[k];
    if (typeof v === "string" && v.trim().length > 1) out[k] = v.trim();
    else faltando.push(k);
  }
  return { out, faltando };
}

/** Monta o pacote compacto de contexto para uma Skill. Barato e determinístico. */
export function buildSkillContext(skill: SkillId, input: SkillContextInput): SkillContextPack {
  const preset = SKILL_PRESETS[skill];
  const id = pick(input.contexto, preset.identidade);
  const rg = pick(input.contexto, preset.regras);

  const identidade: Record<string, string> = { ...id.out };
  if (input.empresa?.nome_fantasia) identidade["nome_fantasia"] = input.empresa.nome_fantasia;
  if (input.tom) identidade["tom_de_voz"] = input.tom;
  if (skill === "morning_brief" && input.empresa?.horario_funcionamento) {
    identidade["horario_funcionamento"] = input.empresa.horario_funcionamento;
  }

  const pack: SkillContextPack = {
    skill,
    identidade,
    regras: rg.out,
    faltando: [...id.faltando, ...rg.faltando, ...(input.tom ? [] : ["tom_de_voz"])],
  };

  if (skill !== "morning_brief" && input.servicos?.length) {
    pack.servicosRelevantes = input.servicos.slice(0, 8);
  }
  if (input.operacional) pack.operacional = input.operacional;
  return pack;
}

/** Texto curto e estável para injeção em prompts de Skills. */
export function skillContextToPrompt(pack: SkillContextPack): string {
  const linhas = [
    `CONTEXTO DA SKILL (${pack.skill}) — informado pelo estabelecimento, não é fonte de números:`,
    JSON.stringify({ identidade: pack.identidade, regras: pack.regras, servicos: pack.servicosRelevantes ?? [] }),
  ];
  if (pack.faltando.length) {
    linhas.push(`Informações ainda não cadastradas (não invente): ${pack.faltando.join(", ")}.`);
  }
  return linhas.join("\n");
}
