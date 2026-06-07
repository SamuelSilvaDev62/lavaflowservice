import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardMetrics, getOportunidades } from "@/lib/lavaflow.functions";
import { getOnboardingState } from "@/lib/onboarding.functions";
import { SetupChecklist } from "@/components/setup-checklist";
import { EmptyDashboard } from "@/components/empty-dashboard";
import { brl, pct, num } from "@/lib/format";
import {
  TrendingUp, TrendingDown, DollarSign, Repeat, Users, ListChecks,
  Sparkles, ArrowRight, Bot, AlertTriangle, Activity, Target, UserPlus,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Kpi({
  label, value, delta, icon: Icon, accent, hint, to,
}: {
  label: string; value: string; delta?: { value: number; positive?: boolean };
  icon: any; accent?: string; hint?: string; to?: string;
}) {
  const inner = (
    <Card className={`h-full ${to ? "hover:border-primary/50 hover:shadow-md transition cursor-pointer" : ""}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
          <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg grid place-content-center shrink-0 ${accent ?? "bg-accent text-accent-foreground"}`}>
            <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          </div>
        </div>
        <p className="font-display text-xl sm:text-2xl font-bold mt-2 tabular-nums">{value}</p>
        {delta && (
          <p className={`text-[11px] mt-1 flex items-center gap-1 ${delta.positive ? "text-success" : "text-destructive"}`}>
            {delta.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pct(Math.abs(delta.value))} vs mês passado
          </p>
        )}
        {hint && !delta && <p className="text-[11px] mt-1 text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const color = score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive";
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} className="text-muted" strokeWidth="6" fill="none" stroke="currentColor" />
        <circle cx="32" cy="32" r={r} className={color} strokeWidth="6" fill="none" stroke="currentColor"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <span className={`absolute inset-0 grid place-content-center font-display font-bold text-sm ${color}`}>{score}</span>
    </div>
  );
}

function Dashboard() {
  const fetchMetrics = useServerFn(getDashboardMetrics);
  const fetchOps = useServerFn(getOportunidades);
  const fetchState = useServerFn(getOnboardingState);
  const { data: m, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchMetrics() });
  const { data: ops } = useQuery({ queryKey: ["oportunidades"], queryFn: () => fetchOps() });
  const { data: state } = useQuery({ queryKey: ["onboarding-state"], queryFn: () => fetchState() });

  if (isLoading || !m) {
    return <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  const isEmpty = state && state.counts.clientes === 0 && state.counts.ordens === 0;

  if (isEmpty) {
    return (
      <>
        <PageHeader title="Painel Executivo" subtitle="Acompanhe o crescimento do seu lava-rápido em tempo real." />
        <SetupChecklist />
        <EmptyDashboard />
      </>
    );
  }

  const scoreColor = m.scoreSaude >= 70 ? "success" : m.scoreSaude >= 40 ? "warning" : "destructive";
  const topOps = ops?.oportunidades.slice(0, 3) ?? [];
  const totalPotencial = ops?.oportunidades.reduce((s, o) => s + o.receitaPotencial, 0) ?? 0;

  return (
    <>
      <PageHeader title="Painel Executivo" subtitle="Seu consultor de crescimento em tempo real." />

      <div data-tour="dash-checklist" className="scroll-mt-20">
        <SetupChecklist />
      </div>

      {/* Card do Assistente — destaque no topo */}
      <Card data-tour="dash-assistente" className="mb-4 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent scroll-mt-20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary text-primary-foreground grid place-content-center shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-display font-semibold text-sm">Assistente LavaFlow</p>
                <span className="text-[10px] uppercase tracking-wider text-primary font-bold">ao vivo</span>
              </div>
              <p className="text-sm sm:text-base font-medium leading-snug">{m.resumoAssistente}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button asChild size="sm" className="h-8 text-xs">
                  <Link to="/oportunidades">Ver oportunidades <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                  <Link to="/assistente">Análises completas</Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score + KPIs de receita — destaque máximo */}
      <div data-tour="dash-kpis" className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3 scroll-mt-20">
        <Card data-tour="dash-score" className={`border-${scoreColor}/30`}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <ScoreRing score={m.scoreSaude} />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score de Saúde</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {m.scoreSaude >= 70 ? "Excelente 🚀" : m.scoreSaude >= 40 ? "Pode melhorar" : "Atenção urgente"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Kpi
          label="Receita Recuperável"
          value={brl(m.receitaRecuperavel)}
          icon={AlertTriangle}
          accent="bg-destructive/10 text-destructive"
          hint={`${m.inativos} clientes parados`}
          to="/clientes/inativos"
        />

        <Kpi
          label="Faturamento do mês"
          value={brl(m.faturamentoMes)}
          delta={{ value: m.crescimento, positive: m.crescimento >= 0 }}
          icon={DollarSign}
          accent="bg-primary/10 text-primary"
        />

        <Kpi
          label="Receita Recorrente"
          value={brl(m.mrr)}
          icon={Repeat}
          accent="bg-success/10 text-success"
          hint={`${m.assinantes} assinantes`}
          to="/assinaturas"
        />
      </div>

      {/* Oportunidades de Hoje */}
      <Card data-tour="dash-oportunidades" className="mb-4 overflow-hidden scroll-mt-20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold">Oportunidades de hoje</h3>
            </div>
            <Link to="/oportunidades" className="text-xs text-primary hover:underline flex items-center gap-1">
              ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topOps.length > 0 ? (
            <>
              <ul className="space-y-2.5">
                {topOps.map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-3 p-2.5 -mx-2.5 rounded-lg hover:bg-accent/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{o.titulo}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{o.descricao}</p>
                    </div>
                    <span className="text-xs font-semibold text-success shrink-0 tabular-nums">+{brl(o.receitaPotencial)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Potencial total hoje</span>
                <span className="font-display font-bold text-primary tabular-nums">{brl(totalPotencial)}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma oportunidade pendente. Continue acompanhando 🎉</p>
          )}
        </CardContent>
      </Card>

      {/* Impacto Financeiro do Mês */}
      <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mt-6 mb-3">
        Impacto financeiro do mês
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi label="Lavagens" value={num(m.lavagensMes)} icon={ListChecks} />
        <Kpi label="Ticket médio" value={brl(m.ticketMedio)} icon={Activity} accent="bg-primary/10 text-primary" />
        <Kpi label="Novos clientes" value={num(m.novosClientesMes)} icon={UserPlus} accent="bg-success/10 text-success" />
        <Kpi label="Retenção 90d" value={pct(m.retencao, 0)} icon={Users} accent="bg-success/10 text-success" />
      </div>

      {/* Gráfico */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Faturamento — últimos 14 dias
            </h3>
          </div>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer>
              <LineChart data={m.serie} margin={{ left: -10, right: 5, top: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="dia" fontSize={10} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={10} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Line type="monotone" dataKey="valor" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
