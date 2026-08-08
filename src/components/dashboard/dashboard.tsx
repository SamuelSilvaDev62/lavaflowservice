import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-layout";
import { getDashboardOperacional, getClienteInativos } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import {
  CalendarDays, Plus, UserPlus, Clock, AlertCircle, Play,
  TrendingUp, Users, ArrowRight, CheckCircle2,
} from "lucide-react";

const KANBAN_COLS: { key: string; label: string }[] = [
  { key: "aguardando", label: "Aguardando" },
  { key: "em_lavagem", label: "Em lavagem" },
  { key: "finalizacao", label: "Finalização" },
  { key: "pronto", label: "Pronto" },
];

function diffMin(hora: string) {
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return Math.round((d.getTime() - Date.now()) / 60000);
}

export function Dashboard() {
  const fetchOps = useServerFn(getDashboardOperacional);
  const fetchInativos = useServerFn(getClienteInativos);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-operacional"],
    queryFn: () => fetchOps(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: inativosData } = useQuery({
    queryKey: ["dashboard-inativos-30"],
    queryFn: () => fetchInativos({ data: { dias: 30 } }),
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />)}
      </div>
    );
  }

  const agenda = (data.agendaHoje ?? []) as any[];
  const veiculos = (data.veiculosEmAtendimento ?? []) as any[];
  const cards = data.cards ?? ({} as any);
  const totalAgenda = Number(cards.agendamentosHoje ?? agenda.length);
  const horariosLivres = Number(cards.horariosLivres ?? 0);
  const ticketMedio = Number(cards.ticketMedio ?? 0);
  const potencial = Number(cards.potencialFaturamento ?? 0);

  // Buckets de reativação a partir dos inativos 30+
  const inativos = ((inativosData?.inativos ?? []) as any[])
    .filter((c) => c.ultima_visita); // ignora "999 dias" (nunca voltou)
  const bucket30 = inativos.filter((c) => c.dias_inativo >= 30 && c.dias_inativo < 60).length;
  const bucket60 = inativos.filter((c) => c.dias_inativo >= 60 && c.dias_inativo < 90).length;
  const bucket90 = inativos.filter((c) => c.dias_inativo >= 90).length;
  const totalReativar = bucket30 + bucket60 + bucket90;

  const kanbanCount = KANBAN_COLS.map((c) => ({
    ...c,
    qtd: veiculos.filter((v) => v.status === c.key).length,
  }));

  return (
    <>
      <PageHeader
        title="Central do Dia"
        subtitle={`${totalAgenda} ${totalAgenda === 1 ? "agendamento" : "agendamentos"} · ${brl(Number(cards.previsaoFaturamentoDia ?? 0))} previstos`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="premium" size="sm"><Link to="/agendamentos"><Plus className="h-4 w-4" /> Agendamento</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/clientes"><UserPlus className="h-4 w-4" /> Cliente</Link></Button>
          </div>
        }
      />

      {/* 1. Oportunidade de hoje — hero */}
      <Card
        className="mb-4 overflow-hidden border-0 text-primary-foreground shadow-lg"
        style={{
          backgroundColor: "var(--primary)",
          backgroundImage:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 92%, white 8%), var(--primary) 55%, color-mix(in oklab, var(--primary) 82%, black 18%))",
        }}
      >
        <CardContent className="p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground/90">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" /> Oportunidade de hoje
          </div>

          {horariosLivres === 0 ? (
            <>
              <p className="font-display text-2xl font-bold text-primary-foreground">Agenda cheia hoje 🎉</p>
              <p className="mt-1 text-sm text-primary-foreground/90">Nenhum horário livre. Ótimo trabalho!</p>
            </>
          ) : (
            <>
              <p className="font-display text-3xl font-bold tabular-nums text-primary-foreground">{brl(potencial)}</p>
              <p className="mt-1 text-sm text-primary-foreground/90">
                <strong className="font-bold text-primary-foreground">{horariosLivres}</strong> {horariosLivres === 1 ? "horário livre" : "horários livres"} × ticket médio de <strong className="font-bold text-primary-foreground">{brl(ticketMedio)}</strong>
              </p>
              <Button
                asChild
                size="sm"
                className="mt-3 border-0 font-semibold shadow-sm"
                style={{ backgroundColor: "var(--card)", backgroundImage: "none", color: "var(--primary)" }}
              >
                <Link to="/agendamentos"><CalendarDays className="h-4 w-4" /> Preencher agenda</Link>
              </Button>
            </>
          )}

        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* 2. Agenda do dia */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Agenda do dia</h2>
            </div>
            {agenda.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum agendamento para hoje.</p>
            ) : (
              <ul className="divide-y">
                {agenda.slice(0, 5).map((a) => {
                  const hora = a.hora_agendada?.slice(0, 5) ?? "--:--";
                  const delta = a.minutos_para_inicio ?? diffMin(hora);
                  const atrasado = a.atrasado ?? (delta < -5 && !["concluido", "entregue", "cancelado", "nao_compareceu"].includes(a.status));
                  const proximo = a.proximo ?? (delta >= -5 && delta <= 60 && ["agendado", "confirmado"].includes(a.status));
                  return (
                    <li key={a.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 py-2.5">
                      <span className="font-display text-lg font-bold tabular-nums">{hora}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.clientes?.nome ?? "Cliente"}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.servicos?.nome ?? "Serviço"}</p>
                      </div>
                      {atrasado ? (
                        <Badge variant="destructive" className="text-[10px]"><AlertCircle className="mr-1 h-3 w-3" />Atrasado</Badge>
                      ) : proximo ? (
                        <Badge className="bg-primary/15 text-primary text-[10px]">Próximo</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">{a.status}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-3 text-right">
              <Button asChild variant="ghost" size="sm"><Link to="/agendamentos">Ver agenda completa <ArrowRight className="h-3 w-3" /></Link></Button>
            </div>
          </CardContent>
        </Card>

        {/* 3. Mini kanban */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Em andamento</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {kanbanCount.map((c) => (
                <Link key={c.key} to="/fila" className="rounded-2xl bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums">{c.qtd}</p>
                </Link>
              ))}
            </div>
            <div className="mt-3 text-right">
              <Button asChild variant="ghost" size="sm"><Link to="/fila">Abrir Kanban <ArrowRight className="h-3 w-3" /></Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Reativação de clientes */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Reativação de clientes</h2>
          </div>
          {totalReativar === 0 ? (
            <div className="flex items-center gap-2 rounded-2xl bg-muted/30 p-3 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Nenhum cliente inativo há mais de 30 dias. Bom trabalho.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <BucketCard label="+30 dias" value={bucket30} tone="warning" />
                <BucketCard label="+60 dias" value={bucket60} tone="warning" />
                <BucketCard label="+90 dias" value={bucket90} tone="destructive" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{totalReativar} clientes precisam de um empurrão.</p>
                <Button asChild size="sm" variant="premium">
                  <Link to="/clientes/inativos">Reativar clientes <ArrowRight className="h-3 w-3" /></Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function BucketCard({ label, value, tone }: { label: string; value: number; tone: "warning" | "destructive" }) {
  const color = tone === "destructive" ? "text-destructive" : "text-warning";
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <p className={`font-display text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
