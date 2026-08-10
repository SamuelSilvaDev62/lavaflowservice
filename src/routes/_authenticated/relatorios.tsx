import { FeatureGate } from "@/components/feature-gate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { getRelatoriosExecutivos, getInsights } from "@/lib/lavaflow.functions";
import { brl, pct } from "@/lib/format";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import { useFeature } from "@/hooks/use-entitlement";
import {
  BarChart3, CalendarDays, Car, CreditCard, DollarSign, Lock, Repeat,
  Sparkles, TrendingUp, UserPlus, Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: () => <RequireRole roles={GESTAO}><FeatureGate feature="relatorios_avancados"><Page /></FeatureGate></RequireRole>,
});

function Page() {
  const fn = useServerFn(getRelatoriosExecutivos);
  const insightsFn = useServerFn(getInsights);
  const { allowed: canUseInsights, isLoading: checkingInsights } = useFeature("analises_inteligentes");
  const { data, isLoading } = useQuery({ queryKey: ["relatorios-executivos"], queryFn: () => fn() });
  const { data: insightsData, isLoading: loadingInsights } = useQuery({
    queryKey: ["intelligence-insights"],
    queryFn: () => insightsFn(),
    enabled: canUseInsights && !checkingInsights,
    retry: false,
  });

  return (
    <>
      <PageHeader
        title="Relatorios Executivos"
        subtitle="Crescimento, recorrencia, retencao e oportunidades do lava-rapido."
        actions={<Button asChild variant="outline"><Link to="/dashboard">Ver operacao do dia</Link></Button>}
      />

      {isLoading && <div className="h-96 rounded-xl bg-muted animate-pulse" />}

      {data && data.cards.faturamentoMensal === 0 && data.servicosMaisVendidos.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title="Seus relatorios aparecem quando voce operar"
          description="Registre ordens de servico e agendamentos para visualizar receita, retencao e oportunidades."
          ctas={[{ label: "Abrir ordens", to: "/ordens" }]}
        />
      )}

      {data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={DollarSign} label="Faturamento mensal" value={brl(data.cards.faturamentoMensal)} tone="success" />
            <Kpi icon={TrendingUp} label="Ticket medio" value={brl(data.cards.ticketMedio)} />
            <Kpi icon={Repeat} label="Receita recorrente" value={brl(data.cards.receitaRecorrente)} />
            <Kpi icon={Users} label="Retencao 90d" value={pct(data.cards.retencao, 0)} tone={data.cards.retencao >= 0.45 ? "success" : "warning"} />
          </div>

          {checkingInsights ? (
            <div className="h-36 rounded-2xl skeleton-shimmer" />
          ) : canUseInsights ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h2 className="font-display font-semibold">Intelligence · Análises inteligentes</h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Sinais detectados automaticamente nos últimos 60 dias da operação.</p>
                  </div>
                  <Badge variant="secondary" className="w-fit">Intelligence</Badge>
                </div>

                {loadingInsights ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-xl skeleton-shimmer" />)}
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {(insightsData?.insights ?? []).map((insight) => (
                      <div key={insight.id} className="rounded-2xl border bg-card/80 p-4">
                        <Badge variant={insight.tipo === "alerta" ? "destructive" : "secondary"} className="mb-2">
                          {insight.tipo === "positivo" ? "Oportunidade" : insight.tipo === "alerta" ? "Atenção" : "Insight"}
                        </Badge>
                        <p className="font-display font-semibold">{insight.titulo}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{insight.descricao}</p>
                        {insight.acao && <p className="mt-2 text-xs font-medium text-primary">Sugestão: {insight.acao}</p>}
                      </div>
                    ))}
                    {(insightsData?.insights ?? []).length === 0 && (
                      <div className="rounded-2xl border bg-card/80 p-4 lg:col-span-3">
                        <p className="text-sm text-muted-foreground">Ainda não há dados suficientes para gerar análises inteligentes.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-muted text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-display font-semibold">Análises inteligentes</h2>
                    <p className="mt-1 text-sm text-muted-foreground">O plano Intelligence identifica padrões, dias fracos e oportunidades automaticamente.</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0"><Link to="/planos">Conhecer Intelligence</Link></Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <h2 className="font-display font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-success" />Receita Influenciada pelo LavaFlow
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {brl(data.receitaInfluenciada.totalInfluenciada)} atribuídos a funcionalidades do sistema neste mês.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 min-w-[260px]">
                  <Mini icon={DollarSign} label="Influenciada" value={brl(data.receitaInfluenciada.totalInfluenciada)} />
                  <Mini icon={TrendingUp} label="Participacao" value={pct(data.receitaInfluenciada.percentual, 1)} />
                </div>
              </div>
              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {data.receitaInfluenciada.categorias.filter((cat: any) => Number(cat.valor ?? 0) > 0 || Number(cat.quantidade ?? 0) > 0).map((cat: any) => (
                  <div key={cat.origem} className="rounded-xl border bg-card/70 p-3">
                    <p className="text-xs text-muted-foreground">{cat.label}</p>
                    <p className="font-display font-bold mt-1">{brl(cat.valor)}</p>
                    <p className="text-xs text-muted-foreground">{cat.quantidade} origem(ns)</p>
                  </div>
                ))}
                {data.receitaInfluenciada.categorias.every((cat: any) => Number(cat.valor ?? 0) === 0 && Number(cat.quantidade ?? 0) === 0) && (
                  <div className="rounded-xl border bg-card/70 p-3 sm:col-span-2 lg:col-span-4">
                    <p className="text-sm text-muted-foreground">Ainda nao ha receita atribuida. Quando campanhas, checklist, fidelidade ou Leva e Traz gerarem vendas, elas aparecem aqui.</p>
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border bg-background/60 p-3">
                  <h3 className="font-display font-semibold text-sm">Conversoes e qualidade</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Mini icon={Sparkles} label="Indice LavaFlow" value={`${data.receitaInfluenciada.indiceLavaFlow.score}/100`} />
                    <Mini icon={TrendingUp} label="Upsell" value={pct(data.receitaInfluenciada.indiceLavaFlow.resumo.conversaoUpsell, 1)} />
                    <Mini icon={Repeat} label="Retorno" value={pct(data.receitaInfluenciada.indiceLavaFlow.resumo.retorno, 1)} />
                    <Mini icon={CalendarDays} label="Comparecimento" value={pct(data.receitaInfluenciada.indiceLavaFlow.resumo.comparecimento, 1)} />
                  </div>
                </div>
                <div className="rounded-2xl border bg-background/60 p-3">
                  <h3 className="font-display font-semibold text-sm">Ultimas receitas atribuidas</h3>
                  <div className="mt-3 space-y-2">
                    {(data.receitaInfluenciada.ultimosEventos ?? []).slice(0, 5).map((evento: any) => (
                      <div key={evento.id} className="flex items-center justify-between gap-3 rounded-xl bg-card/70 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{evento.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{evento.descricao ?? "Receita atribuida"}</p>
                        </div>
                        <span className="font-semibold text-success shrink-0">{brl(Number(evento.valor ?? 0))}</span>
                      </div>
                    ))}
                    {(data.receitaInfluenciada.ultimosEventos ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhuma receita atribuida registrada neste periodo.</p>
                    )}
                  </div>
                </div>
              </div>
              {data.receitaInfluenciada.timeline.length > 0 && (
                <div className="mt-4 space-y-2">
                  {data.receitaInfluenciada.timeline.slice(-7).map((d: any) => (
                    <Bar key={d.dia} label={d.dia.slice(5).split("-").reverse().join("/")} value={d.valor} max={Math.max(...data.receitaInfluenciada.timeline.map((x: any) => x.valor), 1)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
            <Card>
              <CardContent className="p-4">
                <h2 className="font-display font-semibold mb-3">Faturamento dos ultimos dias</h2>
                <div className="space-y-2">
                  {data.serieFaturamento.slice(-14).map((d: any) => (
                    <Bar key={d.dia} label={d.dia.slice(5).split("-").reverse().join("/")} value={d.valor} max={Math.max(...data.serieFaturamento.map((x: any) => x.valor), 1)} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h2 className="font-display font-semibold mb-3">Leva e Traz</h2>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Mini icon={Car} label="Servicos" value={String(data.levaTraz.quantidade)} />
                  <Mini icon={DollarSign} label="Receita" value={brl(data.levaTraz.receita)} />
                </div>
                {data.levaTraz.clientes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ainda nao ha volume relevante de Leva e Traz nos ultimos 90 dias.</p>
                ) : (
                  <div className="space-y-2">
                    {data.levaTraz.clientes.slice(0, 5).map((c: any) => (
                      <div key={c.nome} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                        <span className="truncate">{c.nome}</span>
                        <span className="font-medium">{c.qtd} · {brl(c.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Ranking title="Servicos mais vendidos" items={data.servicosMaisVendidos} />
            <Ranking title="Evolucao de clientes" items={data.evolucaoClientes.map((i: any) => ({ nome: i.mes, qtd: i.novos, valor: i.novos }))} qtdLabel="novos" />
            <Card>
              <CardContent className="p-4">
                <h2 className="font-display font-semibold mb-3">Oportunidades</h2>
                <div className="space-y-2">
                  <Opportunity icon={UserPlus} label="Novos clientes no mes" value={String(data.cards.novosClientes)} />
                  <Opportunity icon={CreditCard} label="Potencial em assinaturas" value={brl(data.cards.potencialAssinaturas)} />
                  <Opportunity icon={CalendarDays} label="Receita recuperavel" value={brl(data.cards.receitaRecuperavel)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "success" | "warning" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
        <p className={`font-display font-bold text-2xl mt-1 tabular-nums ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Mini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="font-display font-bold mt-1">{value}</p>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(4, Math.round((value / max) * 100));
  return (
    <div className="grid grid-cols-[44px_1fr_90px] items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${width}%` }} /></div>
      <span className="text-right font-medium tabular-nums">{brl(value)}</span>
    </div>
  );
}

function Ranking({ title, items, qtdLabel = "serv." }: { title: string; items: any[]; qtdLabel?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="font-display font-semibold mb-3">{title}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 7).map((it: any, i: number) => (
              <div key={it.nome} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <span className="truncate"><Badge variant="secondary" className="mr-2">{i + 1}</Badge>{it.nome}</span>
                <span className="font-medium shrink-0">{it.qtd} {qtdLabel}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Opportunity({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <span className="text-sm text-muted-foreground flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>
      <span className="font-display font-bold tabular-nums">{value}</span>
    </div>
  );
}
