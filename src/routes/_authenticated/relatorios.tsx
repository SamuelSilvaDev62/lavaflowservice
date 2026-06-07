import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { getRelatorios } from "@/lib/lavaflow.functions";
import { brl } from "@/lib/format";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { EmptyState } from "@/components/empty-state";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: Page,
});

function Page() {
  const fn = useServerFn(getRelatorios);
  const { data, isLoading } = useQuery({ queryKey: ["relatorios"], queryFn: () => fn() });

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Últimos 90 dias." />
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
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Faturamento</p><p className="font-display text-2xl font-bold">{brl(data.total)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ordens</p><p className="font-display text-2xl font-bold">{data.qtd}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Entregues</p><p className="font-display text-2xl font-bold text-success">{data.entregues}</p></CardContent></Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardContent className="p-5">
              <h3 className="font-display font-semibold mb-4">Receita por serviço</h3>
              <div className="h-64"><ResponsiveContainer>
                <BarChart data={data.porServico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="nome" fontSize={10} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={10} stroke="var(--color-muted-foreground)" />
                  <Tooltip formatter={(v: any) => brl(Number(v))} />
                  <Bar dataKey="valor" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer></div>
            </CardContent></Card>

            <Card><CardContent className="p-5">
              <h3 className="font-display font-semibold mb-4">Receita por funcionário</h3>
              <div className="h-64"><ResponsiveContainer>
                <BarChart data={data.porFuncionario}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="nome" fontSize={10} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={10} stroke="var(--color-muted-foreground)" />
                  <Tooltip formatter={(v: any) => brl(Number(v))} />
                  <Bar dataKey="valor" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer></div>
            </CardContent></Card>
          </div>
        </>
      )}
    </>
  );
}
