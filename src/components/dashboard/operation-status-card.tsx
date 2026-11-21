import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, CircleDot, Droplets, ListTodo, Workflow } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type OperationCounts = {
  aguardando: number;
  em_lavagem: number;
  finalizacao: number;
  pronto: number;
};

const STAGES = [
  { key: "aguardando", label: "Aguardando", icon: CircleDot, tone: "text-slate-600 dark:text-slate-300", bg: "bg-slate-500/10" },
  { key: "em_lavagem", label: "Em lavagem", icon: Droplets, tone: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
  { key: "finalizacao", label: "Finalização", icon: Workflow, tone: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10" },
  { key: "pronto", label: "Pronto", icon: CheckCircle2, tone: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10" },
] as const;

export function OperationStatusCard({ counts }: { counts: OperationCounts }) {
  const total = Object.values(counts).reduce((sum, v) => sum + Math.max(0, Number(v) || 0), 0);
  return (
    <Card className="h-full min-w-0 overflow-hidden border border-border/60 bg-card shadow-sm">
      <CardContent className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><ListTodo className="h-5 w-5" /></span>
            <div>
              <h2 className="font-display text-base font-bold sm:text-lg">Operação ao vivo</h2>
              <p className="text-xs text-muted-foreground">{total} {total === 1 ? "OS aberta" : "OS abertas"} na fila</p>
            </div>
          </div>
          <Button size="sm" variant="outline" asChild className="gap-1.5">
            <Link to="/fila">Abrir fila <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {STAGES.map(({ key, label, icon: Icon, tone, bg }) => (
            <Link key={key} to="/fila" search={{ etapa: key }} aria-label={`${label}: ${counts[key]} ordens. Abrir esta etapa na fila`} className="group rounded-2xl border border-border/60 bg-muted/20 p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-muted/40 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <div className="flex items-center justify-between">
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${bg} ${tone}`}><Icon className="h-4 w-4" /></span>
                <span className="font-display text-[27px] font-bold tracking-tight tabular-nums">{Math.max(0, Number(counts[key]) || 0)}</span>
              </div>
              <p className="mt-3 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">{label}<ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover:text-primary group-hover:opacity-100" aria-hidden /></p>
            </Link>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <p className="rounded-xl bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {total === 0 ? "Nenhum veículo na fila no momento." : "Status atualizado automaticamente a cada minuto."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
