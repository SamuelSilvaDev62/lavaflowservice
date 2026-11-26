import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  History,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { FeatureGate } from "@/components/feature-gate";
import { PageHeader } from "@/components/app-layout";
import { RequireRole } from "@/components/require-role";
import { AgendaFillPanel } from "@/components/opportunities/agenda-fill-panel";
import { DigitalPresencePanel } from "@/components/opportunities/digital-presence-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { criarCampanhaRecovery, getRecoveryOverview } from "@/lib/recovery.functions";
import { GESTAO } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/oportunidades")({
  head: () => ({ meta: [
    { title: "Oportunidades e Presença Digital · LavaFlow" },
    { name: "description", content: "Prepare sua presença no Google, acompanhe agendamentos associados e desenvolva oportunidades de crescimento." },
    { property: "og:title", content: "Oportunidades e Presença Digital · LavaFlow" },
    { property: "og:description", content: "Presença digital e crescimento com dados reais do estabelecimento." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <RequireRole roles={GESTAO}>
      <FeatureGate feature="oportunidades">
        <Page />
      </FeatureGate>
    </RequireRole>
  ),
});

const prioridadeClass: Record<string, string> = {
  alta: "border-destructive/20 bg-destructive/10 text-destructive",
  media: "border-warning/30 bg-warning/10 text-warning-foreground",
  baixa: "border-border bg-muted text-muted-foreground",
};

const confiancaLabel: Record<string, string> = {
  alta: "confiança alta",
  media: "confiança média",
  baixa: "confiança inicial",
};

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Target;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 shrink-0 text-primary" />
        </div>
        <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function Page() {
  return <>
    <PageHeader title="Oportunidades" subtitle="Aquisição de clientes, presença local e crescimento do seu negócio." />
    <Tabs defaultValue="digital">
      <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
        <TabsTrigger value="digital" className="min-h-11 whitespace-normal">Presença Digital</TabsTrigger>
        <TabsTrigger value="operation" className="min-h-11 whitespace-normal">Recuperação e agenda</TabsTrigger>
      </TabsList>
      <TabsContent value="digital"><DigitalPresencePanel /></TabsContent>
      <TabsContent value="operation"><OperationalOpportunities /></TabsContent>
    </Tabs>
  </>;
}

function OperationalOpportunities() {
  const overviewFn = useServerFn(getRecoveryOverview);
  const criarFn = useServerFn(criarCampanhaRecovery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["recovery-overview"],
    queryFn: () => overviewFn(),
  });

  const criarMut = useMutation({
    mutationFn: (limit: number) => criarFn({ data: { limit } }),
    onSuccess: async (result) => {
      toast.success(`Campanha preparada para ${result.candidatos} cliente(s).`);
      await qc.invalidateQueries({ queryKey: ["recovery-overview"] });
      await qc.invalidateQueries({ queryKey: ["campanhas"] });
      await navigate({ to: "/campanhas" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível preparar a campanha."),
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Oportunidades" subtitle="Analisando recuperação de clientes e capacidade da agenda…" />
        <div className="space-y-4">
          <div className="h-64 rounded-2xl bg-muted animate-pulse" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <PageHeader title="Oportunidades" subtitle="Recovery Engine e Agenda Fill em um só lugar." />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-display font-semibold">Não foi possível calcular as oportunidades agora.</p>
            <p className="mt-1 text-sm text-muted-foreground">{(error as any)?.message ?? "Tente novamente em instantes."}</p>
          </CardContent>
        </Card>
      </>
    );
  }

  const { engine, roi } = data;
  const qtdCampanha = Math.min(20, engine.candidatos.length);
  const taxaPct = Math.round(engine.resumo.taxaConversaoUsada * 100);
  const roiPct = Math.round(roi.taxaConversao * 100);

  return (
    <>
      <PageHeader
        title="Oportunidades"
        subtitle="Preencha capacidade ociosa, recupere clientes no timing certo e acompanhe o que virou receita."
      />

      <div className="space-y-8">
        <AgendaFillPanel />

        <section className="space-y-5 border-t pt-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl font-semibold">Recovery Engine</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Encontra clientes que já passaram da própria janela de retorno e mede o dinheiro atribuído às ações.
              </p>
            </div>
            {engine.resumo.elegiveis > 0 ? (
              <Button
                variant="premium"
                onClick={() => criarMut.mutate(qtdCampanha)}
                disabled={criarMut.isPending || qtdCampanha === 0}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                {criarMut.isPending ? "Preparando…" : `Preparar Recovery (${qtdCampanha})`}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Clientes elegíveis"
              value={String(engine.resumo.elegiveis)}
              helper={`${engine.resumo.altaPrioridade} com prioridade alta agora.`}
              icon={UsersRound}
            />
            <MetricCard
              label="Receita potencial"
              value={brl(engine.resumo.receitaPotencial)}
              helper="Soma do ticket histórico dos clientes elegíveis — não é receita garantida."
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Valor esperado"
              value={brl(engine.resumo.valorEsperado)}
              helper={`${taxaPct}% de conversão usada ${engine.resumo.taxaBaseadaEmHistorico ? "com base no seu histórico" : "como hipótese inicial"}.`}
              icon={Target}
            />
            <MetricCard
              label="Ticket médio"
              value={brl(engine.resumo.ticketMedio)}
              helper={`${engine.resumo.excluidosContatoRecente} contato(s) recente(s) e ${engine.resumo.excluidosJaAgendados} já agendado(s) foram excluídos.`}
              icon={ShieldCheck}
            />
          </div>

          <Card className="overflow-hidden border-primary/20 bg-primary/5">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  <h3 className="font-display font-semibold">Como o motor escolhe</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  O Recovery Engine compara frequência real de visitas, atraso em relação ao padrão do cliente, ticket histórico e quantidade de visitas. Também remove quem foi contatado nos últimos {engine.regras.contatoRecenteDias} dias ou já possui agendamento futuro.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Badge variant="secondary">SQL + regras</Badge>
                <Badge variant="outline">sem IA para calcular elegibilidade</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold">ROI do Recovery neste mês</h2>
            <p className="text-sm text-muted-foreground">Resultado atribuído somente às campanhas criadas por este motor.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Receita atribuída"
              value={brl(roi.receitaAtribuida)}
              helper={roi.receitaAtribuida > 0 ? `${roi.multiploVsGrowth.toFixed(1)}× o valor mensal atual do Growth.` : "Ainda sem OS atribuída ao Recovery neste mês."}
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Clientes recuperados"
              value={String(roi.clientesRecuperados)}
              helper={`${roi.contatosEnviados} envio(s) confirmado(s) no mês.`}
              icon={CheckCircle2}
            />
            <MetricCard
              label="Conversão observada"
              value={`${roiPct}%`}
              helper="Conversões sobre envios confirmados, sem contar apenas abrir o WhatsApp."
              icon={Target}
            />
            <MetricCard
              label="Custo IA registrado"
              value={brl(roi.custoIaRegistrado)}
              helper={roi.custoMensageriaRastreado ? "IA + mensageria rastreadas." : "Mensageria ainda não entra neste custo; o motor atual é majoritariamente determinístico."}
              icon={History}
            />
          </div>

          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Regra de atribuição transparente</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {roi.atribuicao.metodo} Isso indica receita diretamente atribuída pelo critério operacional do LavaFlow; não é uma afirmação de causalidade perfeita.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Abordagem de Recovery preparada</h2>
              <p className="text-sm text-muted-foreground">Usa o Conhecimento do Negócio, mas a execução continua sob aprovação humana.</p>
            </div>
            <Link to="/contexto-negocio" className="hidden text-xs font-medium text-primary hover:underline sm:inline">
              Melhorar contexto
            </Link>
          </div>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{engine.mensagemSugerida}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{engine.contextoUsado.length} sinais de contexto usados</Badge>
                {engine.contextoFaltando.length > 0 && (
                  <Badge variant="outline">{engine.contextoFaltando.length} informações ainda faltando</Badge>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                O Recovery não envia mensagens nesta tela. Ao preparar a campanha, você revisa os contatos em Campanhas, abre o WhatsApp e confirma cada envio. Só a confirmação inicia a janela de atribuição.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Quem o Recovery priorizaria agora</h2>
            <p className="text-sm text-muted-foreground">Ranking determinístico. O score ajuda a ordenar; não é garantia de retorno.</p>
          </div>

          {engine.candidatos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="font-display text-lg font-semibold">Nenhum cliente precisa ser perseguido agora. 😄</p>
                <p className="mt-1 text-sm text-muted-foreground">O motor não encontrou clientes atrasados em relação ao próprio histórico e sem agendamento futuro.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {engine.candidatos.slice(0, 10).map((cliente) => (
                <Card key={cliente.clienteId} className="overflow-hidden">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display font-semibold">{cliente.nome}</p>
                        <p className="text-xs text-muted-foreground">{cliente.diasSemRetornar} dias sem retornar · {cliente.visitas} visita(s)</p>
                      </div>
                      <Badge variant="outline" className={prioridadeClass[cliente.prioridade]}>
                        {cliente.prioridade} · {cliente.score}
                      </Badge>
                    </div>

                    <p className="text-sm leading-relaxed text-muted-foreground">{cliente.motivo}</p>

                    <div className="grid grid-cols-3 gap-3 border-t pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ticket</p>
                        <p className="text-sm font-semibold tabular-nums">{brl(cliente.ticketMedio)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Potencial</p>
                        <p className="text-sm font-semibold tabular-nums">{brl(cliente.receitaPotencial)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sinal</p>
                        <p className="text-xs font-medium capitalize">{confiancaLabel[cliente.confianca]}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {engine.resumo.elegiveis > 10 && (
            <p className="text-center text-xs text-muted-foreground">Mostrando os 10 primeiros de {engine.resumo.elegiveis} clientes elegíveis.</p>
          )}
        </section>

        {engine.resumo.elegiveis > 0 && (
          <Card className="border-primary/20">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display font-semibold">Pronto para transformar o Recovery em ação?</p>
                <p className="mt-1 text-sm text-muted-foreground">Prepare até {qtdCampanha} contatos prioritários e execute dentro do fluxo rastreado de Campanhas.</p>
              </div>
              <Button variant="premium" onClick={() => criarMut.mutate(qtdCampanha)} disabled={criarMut.isPending}>
                {criarMut.isPending ? "Preparando…" : "Preparar Recovery"}
                {!criarMut.isPending && <ArrowRight className="ml-1 h-4 w-4" />}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
