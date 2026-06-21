import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDashboardOperacional, getMissaoDoDia, getSaudeNegocio } from "@/lib/lavaflow.functions";
import { getOnboardingState as getOnboardingStateFn } from "@/lib/onboarding.functions";
import { SetupChecklist } from "@/components/setup-checklist";
import { EmptyDashboard } from "@/components/empty-dashboard";
import { brl } from "@/lib/format";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import {
  AlertTriangle, ArrowRight, Bot, CalendarDays, Car, CheckCircle2, Clock, DollarSign,
  MapPin, MessageCircle, Play, Sparkles, Target, UsersRound, Wrench,
} from "lucide-react";

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
};

function Dashboard() {
  const fetchOps = useServerFn(getDashboardOperacional);
  const fetchMissao = useServerFn(getMissaoDoDia);
  const fetchSaude = useServerFn(getSaudeNegocio);
  const fetchState = useServerFn(getOnboardingStateFn);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-operacional"], queryFn: () => fetchOps(), refetchInterval: 60_000 });
  const { data: missao } = useQuery({ queryKey: ["missao-do-dia"], queryFn: () => fetchMissao(), refetchInterval: 60_000 });
  const { data: saude } = useQuery({ queryKey: ["saude-negocio"], queryFn: () => fetchSaude(), refetchInterval: 60_000 });
  const { data: state } = useQuery({ queryKey: ["onboarding-state"], queryFn: () => fetchState() });

  if (isLoading || !data) {
    return <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  const isEmpty = state && state.counts.clientes === 0 && state.counts.ordens === 0;
  if (isEmpty) {
    return (
      <>
        <PageHeader title="Operação do Dia" subtitle="Configure o LavaFlow para o painel começar a orientar sua rotina." />
        <SetupChecklist />
        <EmptyDashboard />
      </>
    );
  }

  const cards = data.cards;
  const urgentes = data.recomendacoes.filter((r: any) => r.prioridade === "alta");

  return (
    <>
      <PageHeader
        title="Operação do Dia"
        subtitle="Agenda, fila, Leva e Traz e alertas para decidir o próximo passo."
        actions={<Button asChild><Link to="/agendamentos">Abrir agenda <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>}
      />

      <SetupChecklist />

      {missao && <MissaoDoDia missao={missao} />}
      {saude && <SaudeNegocioCard saude={saude} />}

      {urgentes.length > 0 && (
        <Card className="mb-4 border-warning/40 bg-warning/10">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-semibold">Atenção operacional</p>
              <p className="text-sm text-muted-foreground">{urgentes[0]?.mensagem}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi icon={CalendarDays} label="Agendados hoje" value={String(cards.agendamentosHoje)} to="/agendamentos" />
        <Kpi icon={Car} label="Em atendimento" value={String(cards.veiculosEmAtendimento)} to="/fila" tone="warning" />
        <Kpi icon={Wrench} label="Serviços pendentes" value={String(cards.servicosPendentes)} to="/ordens" />
        <Kpi icon={DollarSign} label="Previsão do dia" value={brl(cards.previsaoFaturamentoDia)} tone="success" />
      </div>

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-4">
        <section className="space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <h2 className="flex min-w-0 items-center gap-2 font-display font-semibold"><Clock className="h-4 w-4 text-primary shrink-0" /><span className="truncate">Agenda de hoje</span></h2>
                <Button asChild variant="ghost" size="sm" className="shrink-0 px-2 sm:px-3"><Link to="/agendamentos">Ver tudo</Link></Button>
              </div>
              {data.agendaHoje.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum agendamento para hoje.</p>
              ) : (
                <div className="space-y-2">
                  {data.agendaHoje.slice(0, 8).map((a: any) => (
                    <div key={a.id} className="grid gap-2 overflow-hidden rounded-md border p-3 sm:flex sm:items-center sm:gap-3">
                      <div className="flex items-start justify-between gap-2 sm:block sm:w-14 sm:shrink-0 sm:text-center">
                        <p className="font-display text-lg font-bold tabular-nums leading-none sm:text-base">{a.hora_agendada?.slice(0, 5)}</p>
                        <Badge variant="secondary" className="shrink-0 sm:hidden">{STATUS_LABEL[a.status] ?? a.status}</Badge>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium break-words">{a.clientes?.nome ?? "Cliente"}</p>
                        <p className="text-xs text-muted-foreground break-words">{a.servicos?.nome ?? "Serviço"}</p>
                        <p className="text-xs text-muted-foreground break-words">{a.funcionarios?.nome ?? "Sem colaborador definido"}</p>
                        {a.leva_traz && (
                          <div className="flex flex-wrap gap-1.5 sm:hidden">
                            <Badge className="max-w-full bg-primary/10 text-primary"><MapPin className="h-3 w-3 mr-1 shrink-0" />Leva e Traz</Badge>
                          </div>
                        )}
                      </div>
                      <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-1">
                        <Badge variant="secondary">{STATUS_LABEL[a.status] ?? a.status}</Badge>
                        {a.leva_traz && <Badge className="max-w-full bg-primary/10 text-primary"><MapPin className="h-3 w-3 mr-1 shrink-0" />Leva e Traz</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-display font-semibold flex items-center gap-2 mb-3"><Play className="h-4 w-4 text-warning" />Veículos em atendimento</h2>
              {data.veiculosEmAtendimento.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum veículo em atendimento agora.</p>
              ) : (
                <div className="divide-y">
                  {data.veiculosEmAtendimento.slice(0, 8).map((o: any) => (
                    <div key={o.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{o.clientes?.nome ?? "Cliente"} · {o.veiculos?.placa ?? "Sem placa"}</p>
                        <p className="text-xs text-muted-foreground truncate">{o.servicos?.nome ?? "Serviço"}{o.funcionarios?.nome ? ` · ${o.funcionarios.nome}` : ""}</p>
                      </div>
                      <span className="font-display font-bold tabular-nums">{brl(Number(o.valor ?? 0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-4 w-4 text-primary" />
                <h2 className="font-display font-semibold">Consultor LavaFlow</h2>
              </div>
              <div className="space-y-2">
                {data.recomendacoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem alertas relevantes agora. Continue acompanhando a agenda e a fila.</p>
                ) : data.recomendacoes.slice(0, 5).map((r: any, i: number) => (
                  <div key={`${r.tipo}-${i}`} className="rounded-md bg-card border p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant={r.prioridade === "alta" ? "destructive" : "secondary"}>{r.prioridade}</Badge>
                      {r.cta_to && <a href={r.cta_to} className="text-xs text-primary hover:underline">{r.cta_label ?? "Abrir"}</a>}
                    </div>
                    <p className="text-sm">{r.mensagem}</p>
                  </div>
                ))}
              </div>
              <Button asChild variant="outline" className="w-full mt-3">
                <Link to="/assistente"><Sparkles className="h-4 w-4 mr-2" />Conversar com o assistente</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-display font-semibold flex items-center gap-2 mb-3"><UsersRound className="h-4 w-4 text-primary" />Distribuição da equipe</h2>
              {data.agendaHoje.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem carga de trabalho prevista para hoje.</p>
              ) : (
                <EquipeResumo agendamentos={data.agendaHoje} />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function SaudeNegocioCard({ saude }: { saude: any }) {
  const statusTone =
    saude.status === "excelente" ? "text-success" :
    saude.status === "bom" ? "text-primary" :
    saude.status === "atenção" ? "text-warning" :
    "text-destructive";

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="rounded-md bg-muted p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Saúde do negócio</p>
            <p className={`mt-1 font-display text-4xl font-bold ${statusTone}`}>{saude.score}<span className="text-base text-muted-foreground">/100</span></p>
            <p className="mt-1 text-sm capitalize text-muted-foreground">{saude.status}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{saude.resumo}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(saude.fatores ?? []).slice(0, 6).map((fator: any) => (
                <div key={fator.id} className="rounded-md border p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium">{fator.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{fator.valor}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, fator.valor))}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {(saude.recomendacoes ?? []).length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {saude.recomendacoes.slice(0, 2).map((rec: any) => (
                  <div key={rec.fator} className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                    <span className="font-medium">{rec.fator}: </span>{rec.acao}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MissaoDoDia({ missao }: { missao: any }) {
  return (
    <Card className="mb-4 overflow-hidden border-primary/30 bg-primary/5">
      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <Target className="h-4 w-4 shrink-0" />
              Missão do Dia
            </div>
            <h2 className="font-display text-xl font-bold leading-tight sm:text-2xl">{missao.titulo}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{missao.subtitulo}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniMetric label="Potencial" value={brl(Number(missao.potencialHoje ?? 0))} />
              <MiniMetric label="Tempo" value={`${missao.tempoTotalMin ?? 0} min`} />
              <MiniMetric label="Ticket" value={brl(Number(missao.ticketMedio ?? 0))} />
            </div>
          </div>

          <div className="space-y-2">
            {(missao.acoes ?? []).length === 0 ? (
              <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
                Registre mais ordens, clientes e agendamentos para o LavaFlow gerar uma missão mais precisa.
              </div>
            ) : (missao.acoes ?? []).slice(0, 3).map((acao: any) => (
              <div key={acao.id} className="rounded-md border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant={acao.prioridade === "alta" ? "destructive" : acao.prioridade === "media" ? "default" : "secondary"}>{acao.prioridade}</Badge>
                      <span className="text-xs text-muted-foreground">{brl(Number(acao.impactoEstimado ?? 0))} potencial</span>
                    </div>
                    <p className="font-medium leading-tight">{acao.titulo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{acao.detalhe}</p>
                  </div>
                  {acao.whatsapp ? <MessageCircle className="h-4 w-4 shrink-0 text-primary" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-2 h-8 px-2">
                  <Link to={acao.rota as any}>{acao.cta}<ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-card px-3 py-2">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-display text-sm font-bold sm:text-base">{value}</p>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone, to }: { icon: any; label: string; value: string; tone?: "success" | "warning"; to?: string }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  const content = (
    <Card className={cn("h-full", to ? "hover:border-primary/50 transition-colors" : "")}>
      <CardContent className="flex min-h-[104px] flex-col justify-between p-3 sm:p-4">
        <div className="flex items-start gap-2 text-xs leading-tight text-muted-foreground"><Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{label}</span></div>
        <p className={`font-display font-bold text-xl sm:text-2xl mt-2 tabular-nums break-words ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to as any}>{content}</Link> : content;
}

function EquipeResumo({ agendamentos }: { agendamentos: any[] }) {
  const counts = new Map<string, number>();
  let semResponsavel = 0;
  agendamentos.forEach((a) => {
    if (a.status === "cancelado" || a.status === "nao_compareceu") return;
    const nome = a.funcionarios?.nome;
    if (!nome) semResponsavel += 1;
    else counts.set(nome, (counts.get(nome) ?? 0) + 1);
  });
  return (
    <div className="space-y-2">
      {Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([nome, qtd]) => (
        <div key={nome} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
          <span className="truncate">{nome}</span>
          <Badge variant="secondary">{qtd} serv.</Badge>
        </div>
      ))}
      {semResponsavel > 0 && (
        <div className="flex items-center justify-between rounded-md border border-warning/40 px-3 py-2 text-sm">
          <span>Sem responsável</span>
          <Badge variant="outline">{semResponsavel}</Badge>
        </div>
      )}
    </div>
  );
}
