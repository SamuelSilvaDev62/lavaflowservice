import { z } from "zod";

export const aiPrioritySchema = z.enum(["alta", "media", "baixa"]);
export const aiCategorySchema = z.enum(["retencao", "fidelidade", "assinatura", "upsell", "agenda", "equipe", "financeiro", "relatorio"]);
export const aiActionTypeSchema = z.enum(["whatsapp", "campanha", "assinatura", "agendamento", "relatorio", "configuracao"]);

export const consultorOpportunitySchema = z.object({
  id: z.string(),
  priority: aiPrioritySchema,
  category: aiCategorySchema,
  title: z.string(),
  description: z.string(),
  estimatedImpact: z.number().nonnegative(),
  whyItMatters: z.string(),
  recommendedAction: z.string(),
  actionType: aiActionTypeSchema,
  ctaLabel: z.string(),
  whatsappMessage: z.string().nullable(),
});

export const consultorResponseSchema = z.object({
  summary: z.string(),
  healthScore: z.number().min(0).max(100),
  diagnosis: z.object({
    status: z.enum(["excelente", "bom", "atencao", "critico"]),
    strengths: z.array(z.string()),
    risks: z.array(z.string()),
  }),
  topOpportunities: z.array(consultorOpportunitySchema).max(8),
  weeklyActionPlan: z.array(z.object({
    day: z.string(),
    action: z.string(),
    expectedResult: z.string(),
  })).max(7),
  suggestedCampaigns: z.array(z.object({
    name: z.string(),
    audience: z.string(),
    message: z.string(),
    estimatedImpact: z.number().nonnegative(),
  })).max(5),
  questionsToAskOwner: z.array(z.string()).max(5),
});

export type ConsultorResponse = z.infer<typeof consultorResponseSchema>;
export type ConsultorOpportunity = z.infer<typeof consultorOpportunitySchema>;

const opportunityJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "priority",
    "category",
    "title",
    "description",
    "estimatedImpact",
    "whyItMatters",
    "recommendedAction",
    "actionType",
    "ctaLabel",
    "whatsappMessage",
  ],
  properties: {
    id: { type: "string" },
    priority: { type: "string", enum: ["alta", "media", "baixa"] },
    category: { type: "string", enum: ["retencao", "fidelidade", "assinatura", "upsell", "agenda", "equipe", "financeiro", "relatorio"] },
    title: { type: "string" },
    description: { type: "string" },
    estimatedImpact: { type: "number", minimum: 0 },
    whyItMatters: { type: "string" },
    recommendedAction: { type: "string" },
    actionType: { type: "string", enum: ["whatsapp", "campanha", "assinatura", "agendamento", "relatorio", "configuracao"] },
    ctaLabel: { type: "string" },
    whatsappMessage: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
} as const;

export const consultorJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "healthScore",
    "diagnosis",
    "topOpportunities",
    "weeklyActionPlan",
    "suggestedCampaigns",
    "questionsToAskOwner",
  ],
  properties: {
    summary: { type: "string" },
    healthScore: { type: "number", minimum: 0, maximum: 100 },
    diagnosis: {
      type: "object",
      additionalProperties: false,
      required: ["status", "strengths", "risks"],
      properties: {
        status: { type: "string", enum: ["excelente", "bom", "atencao", "critico"] },
        strengths: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
      },
    },
    topOpportunities: { type: "array", items: opportunityJsonSchema },
    weeklyActionPlan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "action", "expectedResult"],
        properties: {
          day: { type: "string" },
          action: { type: "string" },
          expectedResult: { type: "string" },
        },
      },
    },
    suggestedCampaigns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "audience", "message", "estimatedImpact"],
        properties: {
          name: { type: "string" },
          audience: { type: "string" },
          message: { type: "string" },
          estimatedImpact: { type: "number", minimum: 0 },
        },
      },
    },
    questionsToAskOwner: { type: "array", items: { type: "string" } },
  },
} as const;
