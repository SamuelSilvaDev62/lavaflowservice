import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/app-layout";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import { getReceitaInfluenciada } from "@/lib/lavaflow.functions";
import { brl, pct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, LineChart, Rocket, Sparkles, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crescimento")({
  component: () => <RequireRole roles={GESTAO}><Page /></RequireRole>,
});

const PERIODOS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "ano", label: "Ano" },
];

function Page() {
  const [periodo, setPeriodo] = useState("mes");
  const receitaFn = useServerFn(getReceitaInfluenciada);
  const { data, isLoading } = useQuery({
    queryKey: ["receita-influenciada", periodo],
    queryFn: () => receitaFn({ data: { periodo } }),
  });

  const maxCategoria = Math.max(...(data?.categorias ?? []).map((cat: any) => Number(cat.valor ?? 0)), 1);
  const origemDestaque = data?.categorias?.slice().sort((a: any, b: any) => Number(b.valor) - Number(a.valor))[0];

  return (
    <>
      <PageHeader
        title="Centro de Crescimento"
        subtitle="Meca quanto faturamento foi gerado ou influenciado pelas funcionalidades do LavaFlow."
        actions={
          <div className="flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
              <Button key={p.key} size="sm" variant={periodo === p.key ? "default" : "outline"} onClick={() => setPeriodo(p.key)}>
                {p.label}
              </Button>
            ))}
          </div>
        }
      />

      {isLoading && <div className="h-96 rounded-xl bg-muted animate-pulse" />}

      {data && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={DollarSign} label="Receita influenciada" value={brl(data.totalInfluenciada)} tone="success" />
            <Metric icon={TrendingUp} label="Participacao no faturamento" value={pct(data.percentual, 1)} />
            <Metric icon={LineChart} label="Receita total no periodo" value={brl(data.totalReceita)} />
            <Metric icon={Rocket} label="Origens registradas" value={String(data.categorias.reduce((sum: number, cat: any) => sum + Number(cat.quantidade ?? 0), 0))} />
          </div>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />ROI operacional do LavaFlow
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.totalInfluenciada > 0
                    ? `${brl(data.totalInfluenciada)} foram atribuidos a acoes rastreadas pelo LavaFlow neste periodo.`
                    : "Ainda nao ha receita atribuida. Quando upsells, campanhas, fidelidade ou Leva e Traz gerarem vendas, elas aparecerao aqui."}
                </p>
              </div>
              <Button asChild variant="outline"><Link to="/assistente">Abrir Consultor IA</Link></Button>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="font-display font-semibold">Origem da receita</h2>
                  {origemDestaque && Number(origemDestaque.valor) > 0 && <Badge variant="secondary">Destaque: {origemDestaque.label}</Badge>}
                </div>
                <div className="space-y-3">
                  {data.categorias.map((cat: any) => (
                    <div key={cat.origem} className="rounded-md border bg-card/70 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{cat.label}</span>
                        <span className="font-display font-bold">{brl(cat.valor)}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.round((Number(cat.valor ?? 0) / maxCategoria) * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{cat.quantidade} evento(s) rastreado(s)</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h2 className="font-display font-semibold mb-3">Linha do tempo</h2>
                {data.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum evento de receita influenciada neste periodo.</p>
                ) : (
                  <div className="space-y-2">
                    {data.timeline.slice(-10).map((item: any) => (
                      <div key={item.dia} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{item.dia.slice(5).split("-").reverse().join("/")}</span>
                        <span className="font-medium">{brl(item.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-display font-semibold mb-3">Ultimos eventos atribuidos</h2>
              {data.ultimosEventos.length === 0 ? (
                <p className="text-sm text-muted-foreground">As proximas vendas influenciadas pelo LavaFlow serao listadas aqui.</p>
              ) : (
                <div className="divide-y">
                  {data.ultimosEventos.map((ev: any) => (
                    <div key={ev.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <p className="text-sm font-medium">{ev.label}</p>
                        <p className="text-xs text-muted-foreground">{ev.descricao ?? "Receita atribuida pelo LavaFlow"}</p>
                      </div>
                      <span className="font-display font-bold">{brl(ev.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "success" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
        <p className={`font-display font-bold text-2xl mt-1 tabular-nums ${tone === "success" ? "text-success" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
