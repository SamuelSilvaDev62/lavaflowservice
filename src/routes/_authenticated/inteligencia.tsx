import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import {
  dismissBusinessInsight,
  generateDailySummary,
  generateInactiveClientsCampaign,
  generateIntelligenceInsights,
  generateRevenueDiagnosis,
  listIntelligenceOverview,
  updateTenantAISettings,
} from "@/lib/inteligencia.functions";
import { brl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightCard, type InsightTone } from "@/components/ui/insight-card";
import { SectionSummary, type SectionSummaryItem } from "@/components/ui/section-summary";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inteligencia")({
  component: () => <RequireRole roles={GESTAO}><Page /></RequireRole>,
});

const severityTone: Record<string, InsightTone> = {
  info: "info",
  warning: "warning",
  critical: "critical",
  opportunity: "opportunity",
};

const severityLabel: Record<string, string> = {
  info: "Informação",
  warning: "Atenção",
  critical: "Crítico",
  opportunity: "Oportunidade",
};

const moduleLabel: Record<string, string> = {
  marketing: "Marketing",
  financeiro: "Financeiro",
  operacao: "Operação",
  clientes: "Clientes",
  agenda: "Agenda",
  relatorios: "Relatórios",
  assistente: "Assistente",
};

const moduleIcon: Record<string, any> = {
  marketing: Megaphone,
  financeiro: TrendingDown,
  operacao: Target,
  clientes: Users,
  agenda: Sparkles,
  relatorios: BarChart3,
  assistente: BrainCircuit,
};

type IntensityLevel = "leve" | "equilibrado" | "intenso";

const intensityMap: Record<IntensityLevel, { tokens: number; tasks: number }> = {
  leve: { tokens: 80_000, tasks: 120 },
  equilibrado: { tokens: 200_000, tasks: 300 },
  intenso: { tokens: 500_000, tasks: 800 },
};

function detectIntensity(tokens: number): IntensityLevel {
  if (tokens <= 100_000) return "leve";
  if (tokens >= 400_000) return "intenso";
  return "equilibrado";
}

function Page() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(listIntelligenceOverview);
  const insightsFn = useServerFn(generateIntelligenceInsights);
  const dismissFn = useServerFn(dismissBusinessInsight);
  const campaignFn = useServerFn(generateInactiveClientsCampaign);
  const diagnosisFn = useServerFn(generateRevenueDiagnosis);
  const summaryFn = useServerFn(generateDailySummary);
  const settingsFn = useServerFn(updateTenantAISettings);

  const [campaignResult, setCampaignResult] = useState<any>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [autoInsights, setAutoInsights] = useState(true);
  const [intensity, setIntensity] = useState<IntensityLevel>("equilibrado");

  const { data, isLoading, error } = useQuery({
    queryKey: ["inteligencia-overview"],
    queryFn: () => overviewFn(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data?.settings) return;
    setAiEnabled(Boolean(data.settings.ai_enabled));
    setAutoInsights(Boolean(data.settings.auto_insights_enabled));
    setIntensity(detectIntensity(Number(data.settings.monthly_token_limit ?? 200000)));
  }, [data?.settings]);

  const refreshInsights = useMutation({
    mutationFn: () => insightsFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inteligencia-overview"] });
      toast.success("Oportunidades atualizadas");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar oportunidades"),
  });

  const dismissInsight = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inteligencia-overview"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao dispensar oportunidade"),
  });

  const generateCampaign = useMutation({
    mutationFn: () => campaignFn(),
    onSuccess: (res) => {
      setCampaignResult(res);
      qc.invalidateQueries({ queryKey: ["inteligencia-overview"] });
      qc.invalidateQueries({ queryKey: ["campanhas"] });
      toast.success("Campanha preparada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar campanha"),
  });

  const generateDiagnosis = useMutation({
    mutationFn: () => diagnosisFn(),
    onSuccess: (res) => {
      setDiagnosisResult(res);
      qc.invalidateQueries({ queryKey: ["inteligencia-overview"] });
      toast.success("Análise pronta");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao analisar faturamento"),
  });

  const generateSummary = useMutation({
    mutationFn: () => summaryFn(),
    onSuccess: (res) => {
      setSummaryResult(res);
      qc.invalidateQueries({ queryKey: ["inteligencia-overview"] });
      toast.success("Resumo do dia gerado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar resumo"),
  });

  const saveSettings = useMutation({
    mutationFn: () => {
      const map = intensityMap[intensity];
      return settingsFn({
        data: {
          ai_enabled: aiEnabled,
          monthly_token_limit: map.tokens,
          monthly_task_limit: map.tasks,
          auto_insights_enabled: autoInsights,
          auto_execute_enabled: false,
          preferred_tone: data?.settings?.preferred_tone ?? "profissional",
          business_context: data?.settings?.business_context ?? {},
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inteligencia-overview"] });
      toast.success("Preferências salvas");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar preferências"),
  });

  // Build "Hoje" summary from open insights
  const todayItems = useMemo<SectionSummaryItem[]>(() => {
    if (!data?.insights?.length) {
      return [{ label: "Nenhum ponto crítico hoje — a operação está fluindo.", tone: "success", icon: CheckCircle2 }];
    }
    return data.insights.slice(0, 5).map((insight: any) => ({
      label: insight.title,
      tone: insight.severity === "critical" || insight.severity === "warning" ? "warning" : "info",
      icon: insight.severity === "opportunity" ? TrendingUp : AlertTriangle,
    }));
  }, [data?.insights]);

  return (
    <>
      <PageHeader
        title="Inteligência"
        subtitle="O que está acontecendo, o que tem potencial e onde agir hoje."
        actions={
          <Button onClick={() => refreshInsights.mutate()} disabled={refreshInsights.isPending} variant="premium">
            {refreshInsights.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar análises
          </Button>
        }
      />

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">
            Não foi possível carregar a Inteligência agora. Tente novamente em instantes.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl skeleton-shimmer" />)}
        </div>
      ) : data ? (
        <Tabs defaultValue="hoje" className="space-y-5">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="hoje">Hoje</TabsTrigger>
            <TabsTrigger value="oportunidades">
              Oportunidades
              {data.insights.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5">{data.insights.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analises">Análises</TabsTrigger>
            <TabsTrigger value="modo">Modo Inteligência</TabsTrigger>
          </TabsList>

          {/* HOJE */}
          <TabsContent value="hoje" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <SectionSummary
                eyebrow="Hoje encontramos"
                title="O que precisa da sua atenção"
                items={todayItems}
                cta={{
                  label: "Gerar resumo completo",
                  onClick: () => generateSummary.mutate(),
                  pending: generateSummary.isPending,
                }}
              />

              <div className="grid gap-3">
                <QuickStat icon={Lightbulb} label="Oportunidades abertas" value={String(data.insights.length)} />
                <QuickStat icon={Sparkles} label="Análises este mês" value={String(data.usage.totalTasks)} />
                <QuickStat
                  icon={Target}
                  label="Inteligência"
                  value={data.settings.ai_enabled ? "Ativa" : "Pausada"}
                  tone={data.settings.ai_enabled ? "success" : "muted"}
                />
              </div>
            </div>

            {summaryResult && (
              <GeneratedCard
                title={summaryResult.summary?.headline ?? "Resumo do dia"}
                subtitle="Visão consolidada da operação"
                body={summaryResult.summary?.summary}
                footer={(summaryResult.summary?.tomorrowSuggestions ?? []).join(" · ")}
              />
            )}
          </TabsContent>

          {/* OPORTUNIDADES */}
          <TabsContent value="oportunidades" className="space-y-4">
            {data.insights.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                  <div className="grid h-14 w-14 place-content-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">Tudo certo por aqui</h3>
                  <p className="text-sm text-muted-foreground">
                    Não encontramos oportunidades urgentes. Clique em <strong>Atualizar análises</strong> para uma nova varredura.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 list-stagger">
                {data.insights.map((insight: any, i: number) => {
                  const tone = severityTone[insight.severity] ?? "opportunity";
                  const Icon = moduleIcon[insight.module] ?? Sparkles;
                  const impact = insight.metric_value && insight.metric_key?.toLowerCase().includes("receita")
                    ? brl(Number(insight.metric_value))
                    : insight.metric_value
                      ? Number(insight.metric_value).toLocaleString("pt-BR")
                      : undefined;
                  const isCampaign = insight.action_type === "generate_inactive_clients_campaign" || insight.module === "clientes";
                  const isFinance = insight.action_type === "generate_revenue_diagnosis" || insight.module === "financeiro";
                  return (
                    <div key={insight.id} style={{ ["--i" as any]: i }}>
                      <InsightCard
                        icon={Icon}
                        tone={tone}
                        toneLabel={severityLabel[insight.severity] ?? "Oportunidade"}
                        category={moduleLabel[insight.module] ?? insight.module}
                        title={insight.title}
                        description={insight.description}
                        impact={impact}
                        primaryAction={
                          isCampaign
                            ? { label: "Criar campanha", onClick: () => generateCampaign.mutate(), pending: generateCampaign.isPending, icon: Megaphone }
                            : isFinance
                            ? { label: "Analisar faturamento", onClick: () => generateDiagnosis.mutate(), pending: generateDiagnosis.isPending, icon: BarChart3 }
                            : { label: "Gerar resumo", onClick: () => generateSummary.mutate(), pending: generateSummary.isPending, icon: BrainCircuit }
                        }
                        secondaryAction={{ label: "Dispensar", onClick: () => dismissInsight.mutate(insight.id) }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {campaignResult && (
              <GeneratedCard
                title={campaignResult.output?.campaignTitle ?? campaignResult.campanha?.nome ?? "Campanha preparada"}
                subtitle={`${campaignResult.audience?.total ?? 0} cliente(s) no público · Potencial ${brl(Number(campaignResult.audience?.estimatedImpact ?? 0))}`}
                body={campaignResult.output?.whatsappMessage ?? campaignResult.campanha?.mensagem}
              />
            )}
          </TabsContent>

          {/* ANÁLISES */}
          <TabsContent value="analises" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 list-stagger">
              <div style={{ ["--i" as any]: 0 }}>
                <SpecialistCard
                  icon={TrendingDown}
                  title="Analisar faturamento"
                  description="Compare receita, ticket médio e mix de serviços. Receba um diagnóstico com ações sugeridas."
                  cta="Analisar agora"
                  pending={generateDiagnosis.isPending}
                  onClick={() => generateDiagnosis.mutate()}
                />
              </div>
              <div style={{ ["--i" as any]: 1 }}>
                <SpecialistCard
                  icon={Users}
                  title="Recuperar clientes"
                  description="Identifica quem não retorna há mais de 60 dias e prepara uma campanha personalizada por WhatsApp."
                  cta="Criar campanha"
                  pending={generateCampaign.isPending}
                  onClick={() => generateCampaign.mutate()}
                />
              </div>
              <div style={{ ["--i" as any]: 2 }}>
                <SpecialistCard
                  icon={BrainCircuit}
                  title="Resumo do dia"
                  description="Síntese da operação com pontos positivos, atenções e sugestões para amanhã."
                  cta="Gerar resumo"
                  pending={generateSummary.isPending}
                  onClick={() => generateSummary.mutate()}
                />
              </div>
            </div>

            {diagnosisResult && (
              <GeneratedCard
                title="Análise de faturamento"
                subtitle={`Receita atual: ${brl(Number(diagnosisResult.metrics?.currentRevenue ?? 0))}`}
                body={diagnosisResult.diagnosis?.summary ?? "Análise concluída."}
                footer={(diagnosisResult.diagnosis?.recommendedActions ?? []).join(" · ")}
              />
            )}
          </TabsContent>

          {/* MODO INTELIGÊNCIA */}
          <TabsContent value="modo" className="space-y-4">
            <Card>
              <CardContent className="space-y-6 p-6">
                <div>
                  <h3 className="font-display text-xl font-semibold">Modo Inteligência</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Defina quanto a inteligência deve trabalhar no seu negócio. Mais intensidade = mais análises automáticas.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-4">
                  <div>
                    <Label className="font-semibold">Inteligência ativa</Label>
                    <p className="text-xs text-muted-foreground">Liga e desliga as análises e oportunidades automáticas.</p>
                  </div>
                  <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-4">
                  <div>
                    <Label className="font-semibold">Oportunidades automáticas</Label>
                    <p className="text-xs text-muted-foreground">Identificamos pontos de atenção sem que você precise pedir.</p>
                  </div>
                  <Switch checked={autoInsights} onCheckedChange={setAutoInsights} />
                </div>

                <div>
                  <Label className="font-semibold">Intensidade</Label>
                  <p className="mb-3 text-xs text-muted-foreground">Quanto mais intenso, mais análises por mês.</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["leve", "equilibrado", "intenso"] as IntensityLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setIntensity(lvl)}
                        className={`rounded-2xl border p-4 text-left transition-premium hover-lift ${
                          intensity === lvl
                            ? "border-primary bg-primary/5 shadow-[var(--shadow-neo-inset)]"
                            : "border-border bg-card"
                        }`}
                      >
                        <p className="font-display font-semibold capitalize">{lvl}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {lvl === "leve" && "Análises essenciais apenas."}
                          {lvl === "equilibrado" && "Análises frequentes e oportunidades."}
                          {lvl === "intenso" && "Vigilância contínua e respostas rápidas."}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                  {saveSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Salvar preferências
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </>
  );
}

function QuickStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "success" | "muted" }) {
  const valueClass = tone === "success" ? "text-success" : tone === "muted" ? "text-muted-foreground" : "";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid h-11 w-11 shrink-0 place-content-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`font-display text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SpecialistCard({ icon: Icon, title, description, cta, pending, onClick }: { icon: any; title: string; description: string; cta: string; pending: boolean; onClick: () => void }) {
  return (
    <Card className="transition-premium hover-lift h-full">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-content-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button onClick={onClick} disabled={pending} className="mt-auto w-fit">
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {cta}
        </Button>
      </CardContent>
    </Card>
  );
}

function GeneratedCard({ title, subtitle, body, footer }: { title: string; subtitle?: string; body?: string; footer?: string }) {
  return (
    <Card className="border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardContent className="p-5">
        <Badge variant="secondary">
          <Sparkles className="mr-1 h-3 w-3" />
          Gerado pela Inteligência
        </Badge>
        <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        {body && <p className="mt-4 rounded-2xl bg-muted/40 p-4 text-sm leading-relaxed">{body}</p>}
        {footer && <p className="mt-3 text-xs text-muted-foreground">{footer}</p>}
      </CardContent>
    </Card>
  );
}
