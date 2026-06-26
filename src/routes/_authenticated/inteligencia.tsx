import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Gauge,
  Lightbulb,
  Loader2,
  Megaphone,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  TrendingDown,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inteligencia")({
  component: () => <RequireRole roles={GESTAO}><Page /></RequireRole>,
});

const severityLabel: Record<string, string> = {
  info: "Informacao",
  warning: "Atencao",
  critical: "Critico",
  opportunity: "Oportunidade",
};

const severityClass: Record<string, string> = {
  info: "bg-muted text-muted-foreground border-border",
  warning: "bg-warning/10 text-warning-foreground border-warning/30",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  opportunity: "bg-primary/10 text-primary border-primary/20",
};

const moduleLabel: Record<string, string> = {
  marketing: "Marketing",
  financeiro: "Financeiro",
  operacao: "Operacao",
  clientes: "Clientes",
  agenda: "Agenda",
  relatorios: "Relatorios",
  assistente: "Assistente",
};

type SettingsState = {
  ai_enabled: boolean;
  monthly_token_limit: number;
  monthly_task_limit: number;
  auto_insights_enabled: boolean;
  auto_execute_enabled: boolean;
  preferred_tone: string;
  business_context_text: string;
};

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
  const [settings, setSettings] = useState<SettingsState>({
    ai_enabled: true,
    monthly_token_limit: 200000,
    monthly_task_limit: 300,
    auto_insights_enabled: true,
    auto_execute_enabled: false,
    preferred_tone: "profissional",
    business_context_text: "{}",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["inteligencia-overview"],
    queryFn: () => overviewFn(),
  });

  useEffect(() => {
    if (!data?.settings) return;
    setSettings({
      ai_enabled: Boolean(data.settings.ai_enabled),
      monthly_token_limit: Number(data.settings.monthly_token_limit ?? 200000),
      monthly_task_limit: Number(data.settings.monthly_task_limit ?? 300),
      auto_insights_enabled: Boolean(data.settings.auto_insights_enabled),
      auto_execute_enabled: Boolean(data.settings.auto_execute_enabled),
      preferred_tone: String(data.settings.preferred_tone ?? "profissional"),
      business_context_text: JSON.stringify(data.settings.business_context ?? {}, null, 2),
    });
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
    onError: (e: any) => toast.error(e?.message ?? "Erro ao ignorar oportunidade"),
  });

  const generateCampaign = useMutation({
    mutationFn: () => campaignFn(),
    onSuccess: (res) => {
      setCampaignResult(res);
      qc.invalidateQueries({ queryKey: ["inteligencia-overview"] });
      qc.invalidateQueries({ queryKey: ["campanhas"] });
      toast.success("Campanha preparada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar campanha"),
  });

  const generateDiagnosis = useMutation({
    mutationFn: () => diagnosisFn(),
    onSuccess: (res) => {
      setDiagnosisResult(res);
      qc.invalidateQueries({ queryKey: ["inteligencia-overview"] });
      toast.success("Diagnostico gerado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar diagnostico"),
  });

  const generateSummary = useMutation({
    mutationFn: () => summaryFn(),
    onSuccess: (res) => {
      setSummaryResult(res);
      qc.invalidateQueries({ queryKey: ["inteligencia-overview"] });
      toast.success("Resumo diario gerado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar resumo"),
  });

  const saveSettings = useMutation({
    mutationFn: () => {
      let context: Record<string, any> = {};
      try {
        context = JSON.parse(settings.business_context_text || "{}");
      } catch {
        throw new Error("Contexto do negocio precisa ser um JSON valido.");
      }
      return settingsFn({
        data: {
          ai_enabled: settings.ai_enabled,
          monthly_token_limit: Number(settings.monthly_token_limit),
          monthly_task_limit: Number(settings.monthly_task_limit),
          auto_insights_enabled: settings.auto_insights_enabled,
          auto_execute_enabled: settings.auto_execute_enabled,
          preferred_tone: settings.preferred_tone,
          business_context: context,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inteligencia-overview"] });
      toast.success("Configuracoes salvas");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar configuracoes"),
  });

  const usagePercent = data?.usage?.monthlyTokenLimit
    ? Math.min(100, Math.round((Number(data.usage.totalTokens ?? 0) / Number(data.usage.monthlyTokenLimit)) * 100))
    : 0;

  return (
    <>
      <PageHeader
        title="Inteligencia"
        subtitle="Oportunidades, campanhas e analises geradas a partir dos dados do negocio."
        actions={
          <Button onClick={() => refreshInsights.mutate()} disabled={refreshInsights.isPending}>
            {refreshInsights.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar oportunidades
          </Button>
        }
      />

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">
            Nao foi possivel carregar o modulo de inteligencia. Verifique se a migration nova ja foi aplicada no Supabase.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : data ? (
        <div className="space-y-5">
          <section className="grid gap-3 md:grid-cols-4">
            <MetricCard icon={Lightbulb} label="Oportunidades abertas" value={data.insights.length} />
            <MetricCard icon={Sparkles} label="Acoes no mes" value={data.usage.totalTasks} />
            <MetricCard icon={Gauge} label="Creditos usados" value={`${usagePercent}%`} />
            <MetricCard icon={Settings} label="Modo automatico" value={data.settings.auto_execute_enabled ? "Ligado" : "Desligado"} />
          </section>

          <Tabs defaultValue="oportunidades" className="space-y-4">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
              <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
              <TabsTrigger value="analises">Analises</TabsTrigger>
              <TabsTrigger value="uso">Uso</TabsTrigger>
              <TabsTrigger value="configuracoes">Configuracoes</TabsTrigger>
            </TabsList>

            <TabsContent value="oportunidades" className="space-y-3">
              {data.insights.length === 0 ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma oportunidade aberta. Clique em atualizar para rodar as regras de negocio.</CardContent></Card>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.insights.map((insight: any) => (
                    <Card key={insight.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={severityClass[insight.severity] ?? severityClass.info}>
                                {severityLabel[insight.severity] ?? insight.severity}
                              </Badge>
                              <Badge variant="secondary">{moduleLabel[insight.module] ?? insight.module}</Badge>
                            </div>
                            <h3 className="mt-3 font-display text-lg font-semibold">{insight.title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
                            {insight.metric_key && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Indicador: {insight.metric_key} {insight.metric_value != null ? `= ${Number(insight.metric_value).toLocaleString("pt-BR")}` : ""}
                              </p>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => dismissInsight.mutate(insight.id)} title="Ignorar">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {insight.action_type === "generate_inactive_clients_campaign" || insight.module === "clientes" ? (
                            <Button size="sm" onClick={() => generateCampaign.mutate()} disabled={generateCampaign.isPending}>
                              <Megaphone className="mr-2 h-4 w-4" />Gerar campanha
                            </Button>
                          ) : null}
                          {insight.action_type === "generate_revenue_diagnosis" || insight.module === "financeiro" ? (
                            <Button size="sm" variant="outline" onClick={() => generateDiagnosis.mutate()} disabled={generateDiagnosis.isPending}>
                              <BarChart3 className="mr-2 h-4 w-4" />Analisar
                            </Button>
                          ) : null}
                          {insight.action_type === "generate_daily_summary" ? (
                            <Button size="sm" variant="outline" onClick={() => generateSummary.mutate()} disabled={generateSummary.isPending}>
                              <BrainCircuit className="mr-2 h-4 w-4" />Gerar resumo
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="campanhas" className="space-y-3">
              <Card>
                <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Campanha para clientes inativos</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Calcula o publico por SQL e prepara uma campanha em rascunho, sem envio automatico.
                    </p>
                  </div>
                  <Button onClick={() => generateCampaign.mutate()} disabled={generateCampaign.isPending}>
                    {generateCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                    Preparar campanha
                  </Button>
                </CardContent>
              </Card>
              {campaignResult && (
                <GeneratedCard
                  title={campaignResult.output?.campaignTitle ?? campaignResult.campanha?.nome}
                  subtitle={`${campaignResult.audience?.total ?? 0} cliente(s) no publico`}
                  body={campaignResult.output?.whatsappMessage ?? campaignResult.campanha?.mensagem}
                  footer={`Impacto estimado: ${brl(Number(campaignResult.audience?.estimatedImpact ?? 0))}${campaignResult.cached ? " · reutilizado" : ""}`}
                />
              )}
              <RecentTasks tasks={data.tasks.filter((task: any) => String(task.task_type).includes("campaign"))} />
            </TabsContent>

            <TabsContent value="analises" className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <ActionCard
                  icon={TrendingDown}
                  title="Analisar faturamento"
                  description="Compara receita, ticket, servicos e clientes para gerar um diagnostico simples."
                  actionLabel="Gerar diagnostico"
                  pending={generateDiagnosis.isPending}
                  onClick={() => generateDiagnosis.mutate()}
                />
                <ActionCard
                  icon={Target}
                  title="Gerar resumo diario"
                  description="Resume operacao, pontos positivos, atencoes e sugestoes para o proximo dia."
                  actionLabel="Gerar resumo"
                  pending={generateSummary.isPending}
                  onClick={() => generateSummary.mutate()}
                />
              </div>
              {diagnosisResult && (
                <GeneratedCard
                  title="Diagnostico de faturamento"
                  subtitle={`Receita atual: ${brl(Number(diagnosisResult.metrics?.currentRevenue ?? 0))}`}
                  body={diagnosisResult.diagnosis?.summary ?? "Diagnostico gerado."}
                  footer={(diagnosisResult.diagnosis?.recommendedActions ?? []).join(" · ")}
                />
              )}
              {summaryResult && (
                <GeneratedCard
                  title={summaryResult.summary?.headline ?? "Resumo diario"}
                  subtitle="Operacao do dia"
                  body={summaryResult.summary?.summary ?? "Resumo gerado."}
                  footer={(summaryResult.summary?.tomorrowSuggestions ?? []).join(" · ")}
                />
              )}
              <RecentTasks tasks={data.tasks.filter((task: any) => !String(task.task_type).includes("campaign"))} />
            </TabsContent>

            <TabsContent value="uso" className="space-y-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-display text-xl font-semibold">Uso mensal</h2>
                      <p className="text-sm text-muted-foreground">Acompanhamento para controlar custo e evitar abuso.</p>
                    </div>
                    <Badge variant="outline">{data.usage.totalTasks} tarefa(s)</Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Progress value={usagePercent} />
                    <p className="text-sm text-muted-foreground">
                      {Number(data.usage.totalTokens ?? 0).toLocaleString("pt-BR")} de {Number(data.usage.monthlyTokenLimit ?? 0).toLocaleString("pt-BR")} creditos usados.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniUsage label="Custo estimado" value={brl(Number(data.usage.estimatedCost ?? 0))} />
                    <MiniUsage label="Limite de tarefas" value={data.usage.monthlyTaskLimit} />
                    <MiniUsage label="Modulos ativos" value={data.usage.byModule.length} />
                  </div>
                </CardContent>
              </Card>
              <div className="grid gap-3 md:grid-cols-2">
                {data.usage.byModule.map((row: any) => (
                  <Card key={row.module}>
                    <CardContent className="p-4">
                      <p className="font-semibold">{moduleLabel[row.module] ?? row.module}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{row.tasks} tarefa(s) · {Number(row.tokens ?? 0).toLocaleString("pt-BR")} creditos</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="configuracoes">
              <Card>
                <CardContent className="space-y-5 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ToggleRow label="Inteligencia ativa" checked={settings.ai_enabled} onCheckedChange={(v) => setSettings({ ...settings, ai_enabled: v })} />
                    <ToggleRow label="Gerar oportunidades automaticamente" checked={settings.auto_insights_enabled} onCheckedChange={(v) => setSettings({ ...settings, auto_insights_enabled: v })} />
                    <ToggleRow label="Execucao automatica" checked={settings.auto_execute_enabled} onCheckedChange={(v) => setSettings({ ...settings, auto_execute_enabled: v })} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Tom de comunicacao">
                      <Input value={settings.preferred_tone} onChange={(e) => setSettings({ ...settings, preferred_tone: e.target.value })} />
                    </Field>
                    <Field label="Creditos mensais">
                      <Input type="number" value={settings.monthly_token_limit} onChange={(e) => setSettings({ ...settings, monthly_token_limit: Number(e.target.value) })} />
                    </Field>
                    <Field label="Tarefas mensais">
                      <Input type="number" value={settings.monthly_task_limit} onChange={(e) => setSettings({ ...settings, monthly_task_limit: Number(e.target.value) })} />
                    </Field>
                  </div>
                  <Field label="DNA do negocio">
                    <Textarea rows={8} className="font-mono text-xs" value={settings.business_context_text} onChange={(e) => setSettings({ ...settings, business_context_text: e.target.value })} />
                  </Field>
                  <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                    {saveSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Salvar configuracoes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{value}</p>
          </div>
          <div className="grid h-10 w-10 place-content-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({ icon: Icon, title, description, actionLabel, pending, onClick }: { icon: any; title: string; description: string; actionLabel: string; pending: boolean; onClick: () => void }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-content-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button className="mt-4" onClick={onClick} disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function GeneratedCard({ title, subtitle, body, footer }: { title: string; subtitle?: string; body?: string; footer?: string }) {
  return (
    <Card className="border-primary/20">
      <CardContent className="p-5">
        <Badge variant="secondary">Gerado</Badge>
        <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        {body && <p className="mt-4 rounded-lg border bg-background p-3 text-sm">{body}</p>}
        {footer && <p className="mt-3 text-xs text-muted-foreground">{footer}</p>}
      </CardContent>
    </Card>
  );
}

function RecentTasks({ tasks }: { tasks: any[] }) {
  if (!tasks.length) return <Card><CardContent className="p-5 text-sm text-muted-foreground">Nenhuma tarefa recente nesta secao.</CardContent></Card>;
  return (
    <div className="space-y-2">
      {tasks.slice(0, 6).map((task) => (
        <Card key={task.id}>
          <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{task.task_type}</p>
              <p className="text-xs text-muted-foreground">{moduleLabel[task.module] ?? task.module} · {task.status}</p>
            </div>
            <Badge variant={task.status === "completed" ? "secondary" : "outline"}>{task.execution_mode ?? "regra"}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MiniUsage({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
