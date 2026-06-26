import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendIndicator } from "@/components/trend-indicator";
import { greetingForNow } from "@/lib/design-system";
import { getAlertasOperacionais, getDashboardOperacional } from "@/lib/lavaflow.functions";
import { getOnboardingState as getOnboardingStateFn } from "@/lib/onboarding.functions";
import { listIntelligenceOverview } from "@/lib/inteligencia.functions";
import { SetupChecklist } from "@/components/setup-checklist";
import { EmptyDashboard } from "@/components/empty-dashboard";
import { VehicleVisual } from "@/components/vehicle-visual";
import { InsightCard, type InsightTone } from "@/components/ui/insight-card";
import { brl } from "@/lib/format";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, BrainCircuit, CalendarDays, Car, CheckCircle2, Clock, DollarSign, ExternalLink, Lightbulb, Megaphone, Play, Share2, Sparkles, Target, TrendingDown, TrendingUp, Users } from "lucide-react";


export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => <RequireRole roles={GESTAO}><Dashboard /></RequireRole>,
});

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_andamento: "Em atendimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  nao_compareceu: "Não compareceu",
  aguardando: "Aguardando",
  em_lavagem: "Em lavagem",
  finalizacao: "Finalização",
  pronto: "Pronto",
  entregue: "Entregue",
};

function useFirstName() {
  const [name, setName] = useState<string>("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const full = (meta.full_name as string) || (meta.name as string) || data.user?.email || "";
      setName(String(full).split(" ")[0] ?? "");
    });
  }, []);
  return name;
}

function Dashboard() {
  const fetchOps = useServerFn(getDashboardOperacional);
  const fetchAlertas = useServerFn(getAlertasOperacionais);
  const fetchState = useServerFn(getOnboardingStateFn);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-operacional"], queryFn: () => fetchOps(), refetchInterval: 60_000 });
  const { data: alertasData } = useQuery({ queryKey: ["alertas-operacionais-home"], queryFn: () => fetchAlertas(), refetchInterval: 60_000 });
  const { data: state } = useQuery({ queryKey: ["onboarding-state"], queryFn: () => fetchState() });
  const firstName = useFirstName();

  if (isLoading || !data) {
    return <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />)}</div>;
  }

  const isEmpty = state && state.counts.clientes === 0 && state.counts.ordens === 0;
  if (isEmpty) {
    return (
      <>
        <PageHeader title="Painel Executivo" subtitle="Configure o LavaFlow para acompanhar sua rotina." />
        <SetupChecklist />
        <EmptyDashboard />
      </>
    );
  }

  const cards = data.cards;
  const alertas = (alertasData?.alertas ?? data.alertas ?? []).slice(0, 3);
  const greeting = greetingForNow();
  const agHoje = Number(cards.agendamentosHoje ?? 0);
  const fatHoje = Number(cards.previsaoFaturamentoDia ?? 0);
  const heroLine = agHoje === 0
    ? "Sua agenda está livre hoje — bom momento para acionar uma campanha."
    : `${agHoje} ${agHoje === 1 ? "atendimento" : "atendimentos"} previstos · potencial de ${brl(fatHoje)}`;

  return (
    <>
      <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-card via-card to-accent/30 shadow-[var(--shadow-neo-lg)]">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Painel Executivo</p>
            <h1 className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl">
              {greeting}{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{heroLine}</p>
          </div>
          <Button asChild variant="premium" size="lg" className="shrink-0">
            <Link to="/agendamentos">Abrir agenda <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </CardContent>
      </Card>



      <SetupChecklist />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={CalendarDays} label="Agendamentos de hoje" value={String(cards.agendamentosHoje ?? 0)} to="/agendamentos" trend={(cards as any).trend?.agendamentos} />
        <Kpi icon={Car} label="Veículos em atendimento" value={String(cards.veiculosEmAtendimento ?? 0)} to="/fila" tone="warning" />
        <Kpi icon={DollarSign} label="Projeção de faturamento" value={brl(cards.previsaoFaturamentoDia)} tone="success" trend={(cards as any).trend?.faturamento} />
        <Kpi icon={CheckCircle2} label="Finalizados hoje" value={String(cards.finalizadosHoje ?? 0)} to="/fila" tone="success" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.9fr]">
        <section className="space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <SectionTitle icon={Clock} title="Agenda do Dia" action={<Link to="/agendamentos">Ver agenda completa</Link>} />
              {data.agendaHoje.length === 0 ? (
                <div className="rounded-2xl bg-muted/30 p-6 text-center">
                  <p className="text-sm font-medium">Nenhum agendamento para hoje</p>
                  <p className="mt-1 text-xs text-muted-foreground">Aproveite para ativar sua base — escolha uma ação:</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <Button asChild variant="premium" size="sm"><Link to="/campanhas"><Megaphone className="h-4 w-4" /> Criar campanha</Link></Button>
                    <Button asChild variant="outline" size="sm"><Link to="/configuracoes"><Share2 className="h-4 w-4" /> Compartilhar link</Link></Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {data.agendaHoje.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="grid gap-2 py-3 sm:grid-cols-[64px_1fr_auto] sm:items-center">
                      <p className="font-display text-lg font-bold tabular-nums leading-none">{a.hora_agendada?.slice(0, 5)}</p>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.clientes?.nome ?? "Cliente"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.veiculos?.placa ?? a.veiculos?.modelo ?? "Veículo"} · {a.servicos?.nome ?? "Serviço"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="w-fit">{STATUS_LABEL[a.status] ?? a.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <SectionTitle icon={Play} title="Veículos em Atendimento" action={<Link to="/fila">Abrir fila</Link>} />
              {data.veiculosEmAtendimento.length === 0 ? (
                <EmptyLine>Nenhum veículo em atendimento agora.</EmptyLine>

              ) : (
                <div className="divide-y">
                  {data.veiculosEmAtendimento.map((o: any) => (
                    <div key={o.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{o.clientes?.nome ?? "Cliente"} - {o.veiculos?.placa ?? o.veiculos?.modelo ?? "Veiculo"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {STATUS_LABEL[o.status] ?? o.status}
                          {o.funcionarios?.nome ? ` - ${o.funcionarios.nome}` : ""}
                          {tempoEmAtendimento(o) ? ` - ${tempoEmAtendimento(o)}` : ""}
                        </p>
                      </div>
                      <Badge variant={o.status === "pronto" ? "default" : "secondary"} className="w-fit">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <aside>
          <Card className={alertas.length > 0 ? "border-warning/40" : ""}>
            <CardContent className="p-4">
              <SectionTitle icon={AlertTriangle} title="Alertas" action={<Link to="/fila">Ver todos</Link>} />
              {alertas.length === 0 ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">Operacao funcionando normalmente.</div>
              ) : (
                <div className="space-y-3">
                  {alertas.map((alerta: any, i: number) => (
                    <AlertCard key={`${alerta.tipo}-${i}`} alerta={alerta} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function vehicleName(veiculo: any) {
  return [veiculo?.marca, veiculo?.modelo, veiculo?.vehicle_year].filter(Boolean).join(" ") || veiculo?.placa || "Veiculo";
}

function AlertCard({ alerta }: { alerta: any }) {
  const veiculo = alerta.veiculo ?? alerta.veiculos;
  const cliente = alerta.cliente ?? alerta.clientes;
  const rota = (alerta.rota ?? "/dashboard") as any;
  return (
    <Link to={rota} className="block rounded-lg border bg-card p-3 shadow-soft transition-colors hover:border-primary/50">
      <div className="grid gap-3 sm:grid-cols-[112px_1fr] sm:items-center xl:grid-cols-1 2xl:grid-cols-[120px_1fr]">
        <div className="rounded-lg bg-gradient-to-br from-primary/10 via-muted to-background">
          <VehicleVisual
            brand={veiculo?.marca}
            model={veiculo?.modelo}
            year={veiculo?.vehicle_year}
            color={veiculo?.cor}
            size="sm"
            show360Effect
            className="mx-auto"
          />
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-tight">{alerta.titulo}</p>
            <Badge variant={alerta.prioridade === "alta" ? "destructive" : "secondary"} className="shrink-0 text-[10px] capitalize">
              {alerta.prioridade ?? "media"}
            </Badge>
          </div>
          <p className="truncate text-xs font-medium">{cliente?.nome ?? "Operacao"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {vehicleName(veiculo)}
            {veiculo?.placa ? ` - ${veiculo.placa}` : ""}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[alerta.status] ?? alerta.status ?? alerta.tipo}</Badge>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              {alerta.acao_label ?? "Abrir"} <ExternalLink className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SectionTitle({ icon: Icon, title, action }: { icon: any; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</h2>
      {action && <Button asChild variant="ghost" size="sm" className="shrink-0 px-2 text-xs">{action}</Button>}
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function Kpi({ icon: Icon, label, value, tone, to, trend }: { icon: any; label: string; value: string; tone?: "success" | "warning"; to?: string; trend?: number }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  const content = (
    <Card className={to ? "h-full transition-premium hover-lift" : "h-full"}>
      <CardContent className="flex min-h-[110px] flex-col justify-between p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 text-xs leading-tight text-muted-foreground"><Icon className="h-4 w-4 shrink-0" /><span>{label}</span></div>
          {typeof trend === "number" && <TrendIndicator value={trend} />}
        </div>
        <p className={`mt-2 break-words font-display text-xl font-bold tabular-nums sm:text-2xl ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to as any}>{content}</Link> : content;
}


function tempoEmAtendimento(ordem: any) {
  const ref = ordem.iniciado_em ?? ordem.created_at;
  if (!ref) return "";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
