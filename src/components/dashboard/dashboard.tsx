import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowUpRight, CalendarDays, CalendarPlus, Clock3, Play, RotateCw, Sparkles, UserPlus, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDashboardOperacional } from "@/lib/lavaflow.functions";
import { GrowthEngineCard } from "@/components/dashboard/growth-engine-card";
import { MorningBriefCard } from "@/components/dashboard/morning-brief-card";
import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card";
import { TodayAgendaCard } from "@/components/dashboard/today-agenda-card";
import { OperationStatusCard, type OperationCounts } from "@/components/dashboard/operation-status-card";
import { brl } from "@/lib/format";

function readableDate(value?: string) {
  if (!value) return "Hoje";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric", month: "long", weekday: "long",
  }).format(new Date(value + "T12:00:00"));
}

export function Dashboard() {
  const fetchOps = useServerFn(getDashboardOperacional);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-operacional"],
    queryFn: () => fetchOps(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-5" role="status" aria-label="Carregando Central do Dia">
        <div className="h-40 animate-pulse rounded-[28px] bg-muted" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-muted" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="h-80 animate-pulse rounded-3xl bg-muted" />
          <div className="h-80 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border border-destructive/20">
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h1 className="font-display text-xl font-semibold">Não foi possível carregar a Central do Dia</h1>
          <p className="max-w-md text-sm text-muted-foreground">Não exibimos números desatualizados quando a consulta falha. Tente novamente.</p>
          <Button variant="outline" className="gap-2" onClick={() => refetch()}><RotateCw className="h-4 w-4" /> Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  const agenda = (data.agendaHoje ?? []) as any[];
  const cards = data.cards;
  const totalAgenda = Number(cards.agendamentosHoje ?? agenda.length);
  const horariosLivres = Number(cards.horariosLivres ?? 0);
  const ticketMedio = Number(cards.ticketMedio ?? 0);
  const potencialAgenda = Number(cards.potencialFaturamento ?? 0);
  const statusOperacao: OperationCounts = data.statusOperacao ?? { aguardando: 0, em_lavagem: 0, finalizacao: 0, pronto: 0 };
  const alerts = (data.alertas ?? []) as Array<{ tipo: string; prioridade: string; titulo: string; mensagem: string; rota: string }>;
  const countEmAtendimento = statusOperacao.em_lavagem + statusOperacao.finalizacao;

  return (
    <div className="space-y-5 pb-7">
      <header className="relative overflow-hidden rounded-[28px] border border-primary/10 bg-gradient-to-br from-primary/[0.10] via-card to-card p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-14 -top-24 h-56 w-56 rounded-full bg-primary/[0.06] blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="border border-primary/10 bg-card/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Visão operacional
              </Badge>
              <span className="inline-flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> {readableDate(data.dataLocal)}
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Central do Dia<span className="text-primary">.</span></h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Sua operação, seus compromissos e o que merece atenção — tudo em um só lugar.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary" />{totalAgenda} {totalAgenda === 1 ? "agendamento" : "agendamentos"} hoje</span>
              <span className="inline-flex items-center gap-1.5"><Play className="h-3.5 w-3.5 text-primary" />{countEmAtendimento} em atendimento</span>
              <span className="inline-flex items-center gap-1.5"><RotateCw className={isFetching ? "h-3.5 w-3.5 animate-spin text-primary" : "h-3.5 w-3.5 text-primary"} />Atualiza a cada minuto</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:flex sm:flex-wrap lg:shrink-0">
            <Button asChild variant="premium" className="gap-2">
              <Link to="/agendamentos"><CalendarPlus className="h-4 w-4" /> Novo agendamento</Link>
            </Button>
            <Button asChild variant="outline" className="gap-2 bg-card/90">
              <Link to="/clientes"><UserPlus className="h-4 w-4" /> Novo cliente</Link>
            </Button>
          </div>
        </div>
      </header>

      <section aria-label="Indicadores do dia" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DashboardKpiCard icon={CalendarDays} to="/agendamentos" actionLabel="Abrir agenda" label="Agendamentos" value={String(totalAgenda)} hint="Confirmados e programados para hoje" />
        <DashboardKpiCard icon={Wallet} to="/agendamentos" actionLabel="Conferir reservas" label="Previsão da agenda" value={brl(Number(cards.previsaoFaturamentoDia ?? 0))} hint="Estimativa de reservas ativas, não receita recebida" accent="green" />
        <DashboardKpiCard icon={Play} to="/fila" actionLabel="Abrir fila" label="Em atendimento" value={String(countEmAtendimento)} hint="Veículos em lavagem ou finalização" accent="amber" />
        <DashboardKpiCard icon={Clock3} to="/agendamentos" actionLabel="Ver horários" label="Horários disponíveis" value={String(horariosLivres)} hint={cards.fechadoHoje ? "Sem expediente programado hoje" : cards.expedienteEncerrado ? "Expediente encerrado" : "Vagas restantes para hoje"} accent="slate" />
      </section>

      <MorningBriefCard />

      {alerts.length > 0 && (
        <section aria-label="Alertas operacionais" className="overflow-hidden rounded-3xl border border-amber-500/20 bg-amber-500/[0.045] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <h2 className="font-display text-sm font-bold">Precisa da sua atenção</h2>
            <Badge variant="secondary" className="text-[10px]">{alerts.length}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {alerts.map((alert) => (
              <Link key={alert.tipo} to={alert.rota as any} className="group flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3.5 transition-colors hover:border-primary/30 hover:bg-muted/35">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{alert.titulo}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{alert.mensagem}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <TodayAgendaCard agenda={agenda} total={totalAgenda} />
        <OperationStatusCard counts={statusOperacao} />
      </div>

      <section aria-label="Oportunidades de crescimento" className="space-y-2">
        <div className="flex items-center gap-2 px-0.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">Crescimento do negócio</h2>
          <span className="text-xs text-muted-foreground">Insights baseados na operação</span>
        </div>
        <GrowthEngineCard agendaOpportunity={{
          horariosLivres,
          potencialEstimado: potencialAgenda,
          ticketMedio,
        }} />
      </section>
    </div>
  );
}
