import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { getRelatorios } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { BarChart3, TrendingUp, Package, CheckCircle2, Users, Wrench } from "lucide-react";

const RelatoriosCharts = lazy(() => import("@/components/charts/relatorios-charts"));
const HorizontalRankingChart = lazy(() =>
  import("@/components/charts/relatorios-charts").then((m) => ({ default: m.HorizontalRankingChart })),
);
const ChartFallback = () => <div className="h-64 w-full rounded-md bg-muted/40 animate-pulse" />;

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: Page,
});

function Page() {
  const fn = useServerFn(getRelatorios);
  const { data, isLoading } = useQuery({ queryKey: ["relatorios"], queryFn: () => fn() });
  const [mobileTab, setMobileTab] = useState<"servico" | "func">("servico");

  return (
    <>
      <div className="sm:hidden mb-3">
        <h1 className="font-display text-2xl font-bold">Relatórios</h1>
        <p className="text-xs text-muted-foreground">Últimos 90 dias</p>
      </div>
      <div className="hidden sm:block">
        <PageHeader title="Relatórios" subtitle="Últimos 90 dias." />
      </div>

      {isLoading && <div className="h-96 rounded-xl bg-muted animate-pulse" />}
      {data && data.qtd === 0 && (
        <EmptyState
          icon={BarChart3}
          title="Seus relatórios aparecem quando você operar"
          description="Registre ordens de serviço para visualizar receita por serviço, por funcionário e tendências de crescimento."
          highlight="Lava-rápidos que analisam relatórios mensais crescem 2× mais rápido"
          ctas={[{ label: "Registrar primeira OS", to: "/ordens" }]}
        />
      )}
      {data && data.qtd > 0 && (
        <>
          {/* DESKTOP — cards lado a lado */}
          <div className="hidden sm:grid grid-cols-3 gap-3 mb-6">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Faturamento</p><p className="font-display text-2xl font-bold">{brl(data.total)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ordens</p><p className="font-display text-2xl font-bold">{data.qtd}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Entregues</p><p className="font-display text-2xl font-bold text-success">{data.entregues}</p></CardContent></Card>
          </div>

          {/* MOBILE — hero KPI + chips */}
          <div className="sm:hidden mb-4">
            <div className="rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Faturamento · 90 dias</span>
              </div>
              <p className="font-display font-black text-4xl mt-1 tracking-tight tabular-nums break-all leading-none">
                {brl(data.total)}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-success/15 text-success px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  {data.entregues} entregues
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-card border px-2 py-0.5 rounded-full">
                  <Package className="h-3 w-3" />
                  {data.qtd} ordens
                </span>
              </div>
            </div>

            <div className="-mx-4 px-4 mt-3 flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 [&::-webkit-scrollbar]:hidden">
              <KpiChip emoji="🎯" label="Ticket médio" value={brl(data.qtd ? data.total / data.qtd : 0)} />
              <KpiChip emoji="✅" label="Taxa entrega" value={`${data.qtd ? Math.round((data.entregues / data.qtd) * 100) : 0}%`} />
              <KpiChip emoji="🧼" label="Serviços" value={String(data.porServico.length)} />
              <KpiChip emoji="👥" label="Equipe ativa" value={String(data.porFuncionario.length)} />
            </div>
          </div>

          {/* MOBILE — tabs + gráfico horizontal */}
          <div className="sm:hidden space-y-3">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-xl">
              <button
                onClick={() => setMobileTab("servico")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${mobileTab === "servico" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                <Wrench className="h-3.5 w-3.5" />Serviços
              </button>
              <button
                onClick={() => setMobileTab("func")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${mobileTab === "func" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                <Users className="h-3.5 w-3.5" />Equipe
              </button>
            </div>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-display font-semibold mb-3">
                  Receita por {mobileTab === "servico" ? "serviço" : "funcionário"}
                </h3>
                <HorizontalChart data={(mobileTab === "servico" ? data.porServico : data.porFuncionario).slice(0, 5)} />
                <RankingList items={(mobileTab === "servico" ? data.porServico : data.porFuncionario).slice(0, 5)} />
              </CardContent>
            </Card>
          </div>

          {/* DESKTOP — gráficos lado a lado */}
          <div className="hidden sm:grid lg:grid-cols-2 gap-4">
            <Card><CardContent className="p-5">
              <Suspense fallback={<ChartFallback />}>
                <RelatoriosCharts porServico={data.porServico} porFuncionario={[]} />
              </Suspense>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <Suspense fallback={<ChartFallback />}>
                <RelatoriosCharts porServico={[]} porFuncionario={data.porFuncionario} />
              </Suspense>
            </CardContent></Card>
          </div>
        </>
      )}
    </>
  );
}

function KpiChip({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="snap-start shrink-0 min-w-[130px] rounded-xl border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><span>{emoji}</span>{label}</p>
      <p className="font-display font-bold text-base leading-tight mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function HorizontalChart({ data }: { data: Array<{ nome: string; valor: number }> }) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <HorizontalRankingChart data={data} />
    </Suspense>
  );
}

function RankingList({ items }: { items: Array<{ nome: string; valor: number }> }) {
  if (items.length === 0) return null;
  const medals = ["🥇", "🥈", "🥉"];
  const total = items.reduce((s, i) => s + i.valor, 0);
  return (
    <div className="mt-4 pt-3 border-t space-y-1.5">
      {items.map((it, i) => {
        const pct = total ? Math.round((it.valor / total) * 100) : 0;
        return (
          <div key={it.nome} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0 w-5 text-center">{medals[i] ?? `${i + 1}.`}</span>
              <span className="truncate font-medium">{it.nome}</span>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold tabular-nums leading-none">{brl(it.valor)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{pct}%</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
