import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Lock, Sparkles, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ativarTrialGrowth, getGrowthPreview } from "@/lib/growth.functions";
import { GROWTH_PRICE_BRL, GROWTH_TRIAL_DAYS } from "@/lib/plans";
import { brl } from "@/lib/format";

/**
 * Motor de conversão Free → Growth. Mostra SOMENTE agregados (sem PII) e nunca
 * bloqueia a operação: é um convite contextual baseado nos dados reais do tenant.
 */
export function GrowthEngineCard() {
  const qc = useQueryClient();
  const previewFn = useServerFn(getGrowthPreview);
  const trialFn = useServerFn(ativarTrialGrowth);

  const { data, isLoading } = useQuery({
    queryKey: ["growth-preview"],
    queryFn: () => previewFn(),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const trial = useMutation({
    mutationFn: () => trialFn(),
    onSuccess: (r: any) => {
      toast.success(`Growth liberado por ${r?.dias ?? GROWTH_TRIAL_DAYS} dias. Sem cartão.`);
      qc.invalidateQueries({ queryKey: ["meu-plano"] });
      qc.invalidateQueries({ queryKey: ["growth-preview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível ativar o teste"),
  });

  if (isLoading) return <div className="mt-4 h-32 rounded-2xl skeleton-shimmer" />;
  if (!data) return null;

  const growthAtivo = data.tier === "growth";
  const op = data.oportunidades;

  // Growth ativo: card operacional direto para as oportunidades.
  if (growthAtivo) {
    return (
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Oportunidades de crescimento</h2>
            {data.isTrial && data.trialDiasRestantes !== null && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Teste Growth · {data.trialDiasRestantes}{" "}
                {data.trialDiasRestantes === 1 ? "dia restante" : "dias restantes"}
              </Badge>
            )}
          </div>
          {data.isTrial && data.receitaInfluenciada > 0 && (
            <p className="mb-3 rounded-2xl bg-primary/5 p-3 text-sm">
              <strong className="font-display tabular-nums">{brl(data.receitaInfluenciada)}</strong>{" "}
              de receita influenciada/atribuída no período disponível no sistema.{" "}
              <span className="text-muted-foreground">
                Atribuição por janela de 14 dias após a ação — indicador de acompanhamento, não de causalidade.
              </span>
            </p>
          )}
          {op.total === 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-2xl bg-muted/30 p-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Nenhuma oportunidade pendente agora. Sua base está em dia.
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/oportunidades">
                  Abrir oportunidades <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Retorno" value={op.candidatosRetorno} />
                <Metric label="Recorrência" value={op.candidatosAssinatura} />
                <Metric label="Categorias" value={op.categorias.length} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Potencial estimado de {brl(op.potencialEstimado)} — estimativa, não receita garantida.
                </p>
                <Button asChild size="sm" variant="premium">
                  <Link to="/oportunidades">
                    Ver oportunidades <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Free ainda sem histórico: sem promessa, só orientação honesta.
  if (!data.growthReady) {
    return (
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Seu LavaFlow está aprendendo</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Continue registrando clientes e ordens de serviço. Assim que houver histórico suficiente,
            mostramos aqui onde estão as oportunidades de receita do seu lava-rápido.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Free com histórico: convite contextual com números reais agregados.
  return (
    <Card className="mt-4 border-primary/40">
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold">Encontramos oportunidades na sua operação</h2>
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Lock className="h-3 w-3" /> Growth
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="Podem voltar" value={op.candidatosRetorno} />
          <Metric label="Perfil de plano" value={op.candidatosAssinatura} />
          <Metric label="Frentes de ação" value={op.categorias.length} />
        </div>

        <p className="mt-3 text-sm">
          <strong className="font-display tabular-nums">{brl(op.potencialEstimado)}</strong> de
          potencial estimado a partir do seu ticket médio e histórico.{" "}
          <span className="text-muted-foreground">Estimativa — não é receita garantida.</span>
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {data.trialElegivel ? (
            <Button
              variant="premium"
              size="sm"
              disabled={trial.isPending}
              onClick={() => trial.mutate()}
            >
              {trial.isPending ? "Ativando…" : `Testar Growth ${GROWTH_TRIAL_DAYS} dias sem cartão`}
            </Button>
          ) : (
            <Button asChild variant="premium" size="sm">
              <Link to="/planos">Assinar Growth · {brl(GROWTH_PRICE_BRL)}/mês</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/planos">Ver o que o Growth faz</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <p className="font-display text-2xl font-bold tabular-nums text-primary">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
