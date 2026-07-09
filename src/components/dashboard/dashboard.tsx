import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-layout";
import { getDashboardOperacional, getClienteInativos } from "@/lib/lavaflow.functions";
import { brl, onlyDigits } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { CalendarDays, Plus, UserPlus, Clock, AlertCircle, MessageCircle, Sparkles, Play, CheckCircle2 } from "lucide-react";

const KANBAN_COLS: { key: string; label: string }[] = [
  { key: "aguardando", label: "Aguardando" },
  { key: "em_lavagem", label: "Em lavagem" },
  { key: "finalizacao", label: "Finalização" },
  { key: "pronto", label: "Pronto" },
];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function diffMin(hora: string) {
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return Math.round((d.getTime() - Date.now()) / 60000);
}

export function MvpDashboard() {
  const fetchOps = useServerFn(getDashboardOperacional);
  const fetchInativos = useServerFn(getClienteInativos);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-operacional"],
    queryFn: () => fetchOps(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: inativosData } = useQuery({
    queryKey: ["mvp-inativos-30"],
    queryFn: () => fetchInativos({ data: { dias: 30 } }),
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />)}</div>;
  }

  const now = nowHHMM();
  const agenda = (data.agendaHoje ?? []) as any[];
  const veiculos = (data.veiculosEmAtendimento ?? []) as any[];
  const inativos = ((inativosData?.inativos ?? []) as any[])
    .filter((c) => c.telefone)
    .sort((a, b) => (b.dias_inativo ?? 0) - (a.dias_inativo ?? 0))
    .slice(0, 3);

  const horariosLivresEstim = Math.max(0, 8 - agenda.length);

  const kanbanCount = KANBAN_COLS.map((c) => ({
    ...c,
    qtd: veiculos.filter((v) => v.status === c.key).length,
  }));

  return (
    <>
      <PageHeader
        title="Hoje"
        subtitle={`${agenda.length} ${agenda.length === 1 ? "agendamento" : "agendamentos"} · ${brl(Number(data.cards?.previsaoFaturamentoDia ?? 0))} previstos`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="premium" size="sm"><Link to="/agendamentos"><Plus className="h-4 w-4" /> Agendamento</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/clientes"><UserPlus className="h-4 w-4" /> Cliente</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Hoje */}
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
                {agenda.slice(0, 8).map((a) => {
                  const hora = a.hora_agendada?.slice(0, 5) ?? "--:--";
                  const delta = diffMin(hora);
                  const atrasado = delta < -5 && !["concluido", "entregue", "cancelado", "nao_compareceu"].includes(a.status);
                  const proximo = delta >= -5 && delta <= 60 && ["agendado", "confirmado"].includes(a.status);
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
              <Button asChild variant="ghost" size="sm"><Link to="/agendamentos">Ver agenda completa</Link></Button>
            </div>
          </CardContent>
        </Card>

        {/* Em andamento — mini kanban */}
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
              <Button asChild variant="ghost" size="sm"><Link to="/fila">Abrir Kanban</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights do dia */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Insights do dia</h2>
          </div>

          <div className="space-y-3">
            {horariosLivresEstim > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border bg-card p-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    Você tem <strong>{horariosLivresEstim} horários livres</strong> hoje. Tente preencher para aumentar o faturamento.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline"><Link to="/agendamentos">Abrir agenda</Link></Button>
              </div>
            )}

            {inativos.length === 0 ? (
              <div className="rounded-2xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                Nenhum cliente inativo há mais de 30 dias. Bom trabalho. 👏
              </div>
            ) : (
              inativos.map((c) => {
                const primeiroNome = (c.nome ?? "").split(" ")[0] || "Cliente";
                const msg = c.dias_inativo > 60
                  ? `Olá ${primeiroNome}! Sentimos sua falta! Que tal agendar uma nova lavagem? 🚗✨`
                  : `Olá ${primeiroNome}! Faz ${c.dias_inativo} dias. Que tal renovar o brilho do seu carro?`;
                const tel = onlyDigits(c.telefone ?? "");
                return (
                  <div key={c.id} className="flex items-start gap-3 rounded-2xl border bg-card p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        Cliente <strong>{c.nome}</strong> não retorna há <strong>{c.dias_inativo} dias</strong>.
                      </p>
                    </div>
                    {tel ? (
                      <Button asChild size="sm" variant="premium">
                        <a href={waLink(tel, msg)} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-4 w-4" /> WhatsApp
                        </a>
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Sem telefone</Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
