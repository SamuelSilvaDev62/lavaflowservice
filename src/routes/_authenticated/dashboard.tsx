import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardMetrics, getOportunidades } from "@/lib/lavaflow.functions";
import { brl, pct, num } from "@/lib/format";
import { TrendingUp, TrendingDown, DollarSign, Repeat, Users, Award, ListChecks, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function KPI({ label, value, delta, icon: Icon, accent }: { label: string; value: string; delta?: { value: number; positive?: boolean }; icon: any; accent?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="font-display text-2xl font-bold mt-2">{value}</p>
            {delta && (
              <p className={`text-xs mt-2 flex items-center gap-1 ${delta.positive ? "text-success" : "text-destructive"}`}>
                {delta.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {pct(Math.abs(delta.value))} vs mês anterior
              </p>
            )}
          </div>
          <div className={`h-10 w-10 rounded-lg grid place-content-center ${accent ?? "bg-accent text-accent-foreground"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const fetchMetrics = useServerFn(getDashboardMetrics);
  const fetchOps = useServerFn(getOportunidades);
  const { data: m, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchMetrics() });
  const { data: ops } = useQuery({ queryKey: ["oportunidades"], queryFn: () => fetchOps() });

  if (isLoading || !m) return <div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;

  return (
    <>
      <PageHeader title="Visão geral" subtitle="Acompanhe o crescimento do seu lava-rápido em tempo real." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KPI label="Faturamento do mês" value={brl(m.faturamentoMes)} delta={{ value: m.crescimento, positive: m.crescimento >= 0 }} icon={DollarSign} accent="bg-primary/10 text-primary" />
        <KPI label="Receita recorrente (MRR)" value={brl(m.mrr)} icon={Repeat} accent="bg-success/10 text-success" />
        <KPI label="Lavagens no mês" value={num(m.lavagensMes)} icon={ListChecks} />
        <KPI label="Ticket médio" value={brl(m.ticketMedio)} icon={Award} />
        <KPI label="Clientes ativos" value={num(m.totalClientes - m.inativos)} icon={Users} />
        <KPI label="Clientes inativos" value={num(m.inativos)} icon={Users} accent="bg-destructive/10 text-destructive" />
        <KPI label="Assinantes" value={num(m.assinantes)} icon={CreditCardIcon} accent="bg-primary/10 text-primary" />
        <KPI label="Retenção (90d)" value={pct(m.retencao, 0)} icon={TrendingUp} accent="bg-success/10 text-success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="font-display font-semibold mb-4">Faturamento — últimos 14 dias</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={m.serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="dia" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: any) => brl(Number(v))} />
                  <Line type="monotone" dataKey="valor" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Oportunidades</h3>
              <Link to="/oportunidades" className="text-xs text-primary hover:underline flex items-center gap-1">ver todas <ArrowRight className="h-3 w-3" /></Link>
            </div>
            {ops?.oportunidades.length ? (
              <ul className="space-y-3">
                {ops.oportunidades.slice(0, 4).map((o) => (
                  <li key={o.id} className="text-sm border-l-2 border-primary/40 pl-3">
                    <p className="font-medium">{o.titulo}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{o.descricao}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma oportunidade no momento. 🎉</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CreditCardIcon(p: any) { return <Repeat {...p} />; }
