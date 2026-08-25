import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MessageSquareText,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { criarCampanhaAgendaFill, getAgendaFillOverview } from "@/lib/agenda-fill.functions";

function Metric({ label, value, helper, icon: Icon }: {
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
        <p className="font-display text-xl font-bold tabular-nums">{value}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

export function AgendaFillPanel() {
  const overviewFn = useServerFn(getAgendaFillOverview);
  const criarFn = useServerFn(criarCampanhaAgendaFill);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["agenda-fill-overview"],
    queryFn: () => overviewFn(),
    staleTime: 2 * 60_000,
  });

  const criarMut = useMutation({
    mutationFn: (limit: number) => criarFn({ data: { limit } }),
    onSuccess: async (result) => {
      toast.success(`Agenda Fill preparado para ${result.candidatos} cliente(s).`);
      await qc.invalidateQueries({ queryKey: ["agenda-fill-overview"] });
      await qc.invalidateQueries({ queryKey: ["campanhas"] });
      await navigate({ to: "/campanhas" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível preparar o Agenda Fill."),
  });

  if (isLoading) return <div className="h-64 rounded-2xl bg-muted animate-pulse" />;
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Agenda Fill indisponível agora. O Recovery continua funcionando normalmente.
        </CardContent>
      </Card>
    );
  }

  const { oportunidade, resumo, candidatos } = data;
  const ocupacaoPct = oportunidade.ocupacao == null ? 0 : Math.round(oportunidade.ocupacao * 100);
  const taxaPct = Math.round(resumo.taxaConversaoUsada * 100);
  const podeAgir = oportunidade.horariosLivres > 0 && resumo.contatosRecomendados > 0;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold">Agenda Fill</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Encontra a capacidade mais ociosa dos próximos dias e prioriza clientes perto da própria janela de retorno.
          </p>
        </div>
        {podeAgir && (
          <Button
            variant="premium"
            onClick={() => criarMut.mutate(resumo.contatosRecomendados)}
            disabled={criarMut.isPending}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            {criarMut.isPending ? "Preparando…" : `Preparar Agenda Fill (${resumo.contatosRecomendados})`}
          </Button>
        )}
      </div>

      {!oportunidade.data ? (
        <Card className="border-success/20 bg-success/5">
          <CardContent className="flex items-start gap-3 p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="font-display font-semibold">Nenhuma capacidade ociosa acionável nos próximos {data.regras.lookaheadDias} dias.</p>
              <p className="mt-1 text-sm text-muted-foreground">O motor só sugere campanha quando existe espaço real na configuração da agenda.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Melhor janela"
              value={oportunidade.dataLabel ?? oportunidade.data}
              helper={`${oportunidade.agendamentos} agendamento(s) sobre a capacidade ainda utilizável.`}
              icon={CalendarDays}
            />
            <Metric
              label="Ocupação"
              value={`${ocupacaoPct}%`}
              helper={`${oportunidade.horariosLivres} horário(s) ainda livres nessa janela.`}
              icon={Clock3}
            />
            <Metric
              label="Potencial de capacidade"
              value={brl(oportunidade.potencialCapacidade)}
              helper={`Horários livres × ticket histórico de ${brl(oportunidade.ticketMedio)}. Estimativa, não receita garantida.`}
              icon={CircleDollarSign}
            />
            <Metric
              label="Clientes no timing"
              value={String(resumo.elegiveis)}
              helper={`${resumo.contatosRecomendados} contato(s) recomendados · ${taxaPct}% de conversão usada ${resumo.taxaBaseadaEmHistorico ? "pelo histórico" : "como hipótese inicial"}.`}
              icon={UsersRound}
            />
          </div>

          {resumo.elegiveis === 0 ? (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="p-5">
                <p className="font-display font-semibold">Existe espaço, mas o LavaFlow não encontrou quem chamar com confiança.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Melhor deixar horário vazio do que forçar mensagem para cliente fora do timing. Clientes agendados e contatos dos últimos {data.regras.contatoRecenteDias} dias ficam de fora.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <h3 className="font-display font-semibold">Quem faz mais sentido chamar</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Score de timing + recorrência + ticket + confiança do histórico.</p>
                  </div>
                  <div className="divide-y">
                    {candidatos.slice(0, 5).map((cliente) => (
                      <div key={cliente.clienteId} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{cliente.nome}</p>
                            <Badge variant="outline" className="text-[10px]">score {cliente.score}</Badge>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{cliente.motivo}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-muted-foreground">ticket</p>
                          <p className="text-sm font-semibold tabular-nums">{brl(cliente.ticketMedio)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {candidatos.length > 5 && (
                    <p className="text-xs text-muted-foreground">Mais {candidatos.length - 5} cliente(s) elegíveis no ranking.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-semibold">Abordagem preparada</h3>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{data.mensagemSugerida}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{data.contextoUsado.length} sinais de contexto</Badge>
                    <Badge variant="outline">{resumo.contatosRecomendados} contatos sugeridos</Badge>
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    Valor esperado dos contatos: <strong className="text-foreground">{brl(resumo.valorEsperado)}</strong>. O envio continua manual em Campanhas e só é marcado depois da confirmação no WhatsApp.
                  </div>
                  <Button
                    className="w-full"
                    variant="premium"
                    onClick={() => criarMut.mutate(resumo.contatosRecomendados)}
                    disabled={criarMut.isPending}
                  >
                    <Target className="mr-1 h-4 w-4" />
                    {criarMut.isPending ? "Preparando…" : "Preparar campanha rastreável"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </section>
  );
}
