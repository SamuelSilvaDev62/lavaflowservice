import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowUpRight, CalendarClock, CalendarPlus, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type TodayAppointment = {
  id: string;
  hora_agendada?: string | null;
  status: string;
  proximo?: boolean;
  atrasado?: boolean;
  clientes?: { nome?: string | null } | null;
  servicos?: { nome?: string | null } | null;
  funcionarios?: { nome?: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado",
  em_andamento: "Em andamento", concluido: "Concluído",
  entregue: "Entregue", cancelado: "Cancelado",
  nao_compareceu: "Não compareceu",
};

function AppointmentStatus({ item }: { item: TodayAppointment }) {
  if (item.atrasado) return <Badge variant="destructive" className="gap-1 text-[10px]"><AlertCircle className="h-3 w-3" />Atenção</Badge>;
  if (item.proximo) return <Badge className="border-primary/20 bg-primary/10 text-[10px] text-primary hover:bg-primary/10">Próximo</Badge>;
  return <Badge variant="secondary" className="max-w-full text-[10px]">{STATUS_LABELS[item.status] ?? "Em atendimento"}</Badge>;
}

export function TodayAgendaCard({ agenda, total }: { agenda: TodayAppointment[]; total: number }) {
  return (
    <Card className="h-full min-w-0 overflow-hidden border border-border/60 bg-card shadow-sm">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CalendarClock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-base font-bold sm:text-lg">Agenda do dia</h2>
              <p className="text-xs text-muted-foreground">{total} {total === 1 ? "atendimento programado" : "atendimentos programados"}</p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/agendamentos">Ver agenda <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>

        {agenda.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Clock3 className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display font-semibold">Sua agenda está livre hoje</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Registre um atendimento para começar a acompanhar a operação.</p>
            </div>
            <Button asChild size="sm" variant="outline" className="gap-2"><Link to="/agendamentos"><CalendarPlus className="h-4 w-4" /> Abrir agenda</Link></Button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {agenda.slice(0, 5).map((a, index) => (
              <div key={a.id} className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/35 sm:px-5">
                <div className={`flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center ${index === 0 ? "border-primary/20 bg-primary/[0.06]" : "border-border/60 bg-muted/35"}`}>
                  <span className="font-display text-sm font-bold tabular-nums">{a.hora_agendada?.slice(0, 5) ?? "--:--"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.clientes?.nome || "Cliente"}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.servicos?.nome || "Serviço não informado"}</p>
                  {a.funcionarios?.nome && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Responsável: {a.funcionarios.nome}</p>}
                </div>
                <div className="shrink-0"><AppointmentStatus item={a} /></div>
              </div>
            ))}
            {total > 5 && <p className="px-5 py-3 text-center text-xs text-muted-foreground">Mais {total - 5} {total - 5 === 1 ? "agendamento" : "agendamentos"} na agenda completa</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
