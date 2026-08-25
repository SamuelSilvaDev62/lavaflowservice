import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-layout";
import { getDashboardOperacional } from "@/lib/lavaflow.functions";
import { GrowthEngineCard } from "@/components/dashboard/growth-engine-card";
import { MorningBriefCard } from "@/components/dashboard/morning-brief-card";
import { brl } from "@/lib/format";
import {
  Plus, UserPlus, Clock, AlertCircle, Play, ArrowRight,
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
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-operacional"],
    queryFn: () => fetchOps(),
    refetchInterval: 60_000,
    staleTime: 30_000,
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
  const potencialAgenda = Number(cards.potencialFaturamento ?? 0);

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

      {/* 1. Morning Brief — protagonista da leitura inteligente do dia */}
      <MorningBriefCard />

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

      {/* 4. Growth Engine — usa a mesma oportunidade operacional vista pelo Brief */}
      <GrowthEngineCard
        agendaOpportunity={{
          horariosLivres,
          potencialEstimado: potencialAgenda,
          ticketMedio,
        }}
      />
    </>
  );
}
