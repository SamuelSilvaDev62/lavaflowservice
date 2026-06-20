import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDashboardOperacional } from "@/lib/lavaflow.functions";
import { getOnboardingState as getOnboardingStateFn } from "@/lib/onboarding.functions";
import { SetupChecklist } from "@/components/setup-checklist";
import { EmptyDashboard } from "@/components/empty-dashboard";
import { brl } from "@/lib/format";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import {
  AlertTriangle, ArrowRight, Bot, CalendarDays, Car, Clock, DollarSign,
  MapPin, Play, Sparkles, UsersRound, Wrench,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => <RequireRole roles={GESTAO}><Dashboard /></RequireRole>,
});

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  em_andamento: "Em atendimento",
  concluido: "Concluido",
  cancelado: "Cancelado",
  nao_compareceu: "Nao compareceu",
};

function Dashboard() {
  const fetchOps = useServerFn(getDashboardOperacional);
  const fetchState = useServerFn(getOnboardingStateFn);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-operacional"], queryFn: () => fetchOps(), refetchInterval: 60_000 });
  const { data: state } = useQuery({ queryKey: ["onboarding-state"], queryFn: () => fetchState() });

  if (isLoading || !data) {
    return <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  const isEmpty = state && state.counts.clientes === 0 && state.counts.ordens === 0;
  if (isEmpty) {
    return (
      <>
        <PageHeader title="Operacao do Dia" subtitle="Configure o LavaFlow para o painel comecar a orientar sua rotina." />
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
        title="Operacao do Dia"
        subtitle="Agenda, fila, Leva e Traz e alertas para decidir o proximo passo."
        actions={<Button asChild><Link to="/agendamentos">Abrir agenda <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>}
      />

      <SetupChecklist />

      {urgentes.length > 0 && (
        <Card className="mb-4 border-warning/40 bg-warning/10">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-semibold">Atencao operacional</p>
              <p className="text-sm text-muted-foreground">{urgentes[0]?.mensagem}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi icon={CalendarDays} label="Agendados hoje" value={String(cards.agendamentosHoje)} to="/agendamentos" />
        <Kpi icon={Car} label="Em atendimento" value={String(cards.veiculosEmAtendimento)} to="/fila" tone="warning" />
        <Kpi icon={Wrench} label="Servicos pendentes" value={String(cards.servicosPendentes)} to="/ordens" />
        <Kpi icon={DollarSign} label="Previsao do dia" value={brl(cards.previsaoFaturamentoDia)} tone="success" />
      </div>

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-4">
        <section className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Agenda de hoje</h2>
                <Button asChild variant="ghost" size="sm"><Link to="/agendamentos">Ver tudo</Link></Button>
              </div>
              {data.agendaHoje.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum agendamento para hoje.</p>
              ) : (
                <div className="space-y-2">
                  {data.agendaHoje.slice(0, 8).map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-md border p-3">
                      <div className="w-14 shrink-0 text-center">
                        <p className="font-display font-bold tabular-nums">{a.hora_agendada?.slice(0, 5)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{a.clientes?.nome ?? "Cliente"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.servicos?.nome ?? "Servico"}{a.funcionarios?.nome ? ` · ${a.funcionarios.nome}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary">{STATUS_LABEL[a.status] ?? a.status}</Badge>
                        {a.leva_traz && <Badge className="bg-primary/10 text-primary"><MapPin className="h-3 w-3 mr-1" />Leva e Traz</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-display font-semibold flex items-center gap-2 mb-3"><Play className="h-4 w-4 text-warning" />Veiculos em atendimento</h2>
              {data.veiculosEmAtendimento.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum veiculo em atendimento agora.</p>
              ) : (
                <div className="divide-y">
                  {data.veiculosEmAtendimento.slice(0, 8).map((o: any) => (
                    <div key={o.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{o.clientes?.nome ?? "Cliente"} · {o.veiculos?.placa ?? "Sem placa"}</p>
                        <p className="text-xs text-muted-foreground truncate">{o.servicos?.nome ?? "Servico"}{o.funcionarios?.nome ? ` · ${o.funcionarios.nome}` : ""}</p>
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
              <h2 className="font-display font-semibold flex items-center gap-2 mb-3"><UsersRound className="h-4 w-4 text-primary" />Distribuicao da equipe</h2>
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

function Kpi({ icon: Icon, label, value, tone, to }: { icon: any; label: string; value: string; tone?: "success" | "warning"; to?: string }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  const content = (
    <Card className={to ? "hover:border-primary/50 transition-colors" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
        <p className={`font-display font-bold text-2xl mt-1 tabular-nums ${cls}`}>{value}</p>
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
          <span>Sem responsavel</span>
          <Badge variant="outline">{semResponsavel}</Badge>
        </div>
      )}
    </div>
  );
}
