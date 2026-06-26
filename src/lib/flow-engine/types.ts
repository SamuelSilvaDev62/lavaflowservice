export type FlowModule = "marketing" | "financeiro" | "operacao" | "clientes" | "agenda" | "relatorios" | "assistente";
export type FlowSource = "dashboard" | "assistant" | "automation" | "manual_action";
export type FlowPriority = "low" | "normal" | "high";
export type FlowExecutionMode = "sql" | "rule" | "cache" | "opensquad" | "hybrid";
export type InsightSeverity = "info" | "warning" | "critical" | "opportunity";

export type FlowTaskRequest = {
  tenantId: string;
  userId: string;
  taskType: string;
  module: FlowModule;
  input: Record<string, any>;
  priority?: FlowPriority;
  source?: FlowSource;
};

export type FlowTaskDecision = {
  executionMode: FlowExecutionMode;
  reason: string;
  estimatedCost?: number;
  canExecute: boolean;
  requiredPermissions: string[];
};

export type BusinessInsight = {
  id: string;
  tenantId: string;
  severity: InsightSeverity;
  module: FlowModule;
  title: string;
  description: string;
  metric?: string;
  value?: number;
  suggestedAction?: string;
  actionType?: string;
  actionPayload?: Record<string, any>;
  createdAt: string;
};

export type OpenSquadTaskRequest = {
  tenantId: string;
  userId: string;
  squadKey: string;
  taskKey: string;
  context: Record<string, any>;
  constraints?: {
    maxTokens?: number;
    tone?: string;
    language?: "pt-BR";
    outputFormat?: "text" | "json" | "markdown";
  };
};

export type OpenSquadTaskResult = {
  success: boolean;
  output: any;
  tokensUsed?: number;
  modelUsed?: string;
  executionTimeMs?: number;
  error?: string;
};

export type SegmentTemplate = {
  labels: {
    serviceOrder: string;
    worker: string;
    asset: string;
    workflow: string;
  };
  defaultStages: string[];
  defaultInsights: string[];
};
