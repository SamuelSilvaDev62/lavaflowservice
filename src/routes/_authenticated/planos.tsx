import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlement } from "@/hooks/use-entitlement";
import { abrirPortalAssinatura, criarCheckoutAssinatura, trocarPlanoAssinatura } from "@/lib/billing.functions";
import { FOUNDERS_OFFER, PLANS, STATUS_LABELS, planLabel, type PlanId } from "@/lib/plans";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlanosPage,
  head: () => ({
    meta: [
      { title: "Planos e assinatura — LavaFlow" },
      { name: "description", content: "Escolha o plano do seu lava-rápido: Essencial, Growth ou Intelligence." },
      { property: "og:title", content: "Planos e assinatura — LavaFlow" },
      { property: "og:description", content: "Escolha o plano do seu lava-rápido: Essencial, Growth ou Intelligence." },
    ],
  }),
});

function PlanosPage() {
  const { entitlement, stripeConfigurado, hasManagedSubscription, refetch } = useEntitlement();
  const qc = useQueryClient();
  const checkout = useServerFn(criarCheckoutAssinatura);
  const trocar = useServerFn(trocarPlanoAssinatura);
  const portal = useServerFn(abrirPortalAssinatura);

  // Voltando da Stripe: revalida o entitlement para o menu/gates refletirem o plano novo.
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: ["meu-plano"] });
  }, [qc]);

  const irPara = (url?: string | null) => {
    if (url) window.location.href = url;
    else toast.error("Não foi possível continuar. Tente novamente em instantes.");
  };

  const assinar = useMutation({
    mutationFn: (plan: PlanId) => checkout({ data: { plan, founders: false } }),
    onSuccess: (r: any) => {
      // Backend detectou assinatura viva na Stripe: nunca criar cobrança nova.
      if (r?.modo === "trocar" && !r?.url) {
        toast.info(r?.motivo ?? "Você já tem uma assinatura ativa. Use “Trocar plano”.");
        void refetch();
        return;
      }
      irPara(r?.url);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar assinatura"),
  });

  const trocarPlano = useMutation({
    mutationFn: (plan: PlanId) => trocar({ data: { plan } }),
    onSuccess: (r: any) => {
      if (r?.modo === "atual") {
        toast.info("Este já é o plano da sua assinatura.");
        void refetch();
        return;
      }
      irPara(r?.url);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao abrir a troca de plano"),
  });

  const gerenciar = useMutation({
    mutationFn: () => portal(),
    onSuccess: (r: any) => irPara(r?.url),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao abrir o portal"),
  });

  const ocupado = assinar.isPending || trocarPlano.isPending || gerenciar.isPending;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Planos</h1>
        <p className="text-sm text-muted-foreground">
          Plano atual: <strong>{planLabel(entitlement.plan, entitlement.isFounders)}</strong> ·{" "}
          {STATUS_LABELS[entitlement.status] ?? entitlement.status}
          {entitlement.isTrial && entitlement.trialEndsAt
            ? ` · teste até ${new Date(entitlement.trialEndsAt).toLocaleDateString("pt-BR")}`
            : ""}
        </p>
        {entitlement.isFounders && (
          <Badge className="gap-1">
            <Crown className="h-3.5 w-3.5" /> Oferta Founders — acesso completo
          </Badge>
        )}
      </header>

      {!stripeConfigurado && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            A cobrança ainda não está configurada neste ambiente. Assim que as credenciais de
            pagamento forem adicionadas, o botão de assinatura funcionará normalmente.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plano) => {
          // Founders mantém acesso equivalente ao Intelligence: esse card conta como atual.
          const atual =
            entitlement.planoAssinado === plano.id ||
            (entitlement.isFounders && plano.id === FOUNDERS_OFFER.planoEquivalente);
          return (
            <Card
              key={plano.id}
              className={cn(
                "relative flex h-full flex-col",
                plano.recomendado && "border-primary/60 ring-1 ring-primary/30",
              )}
            >
              {plano.recomendado && (
                <Badge className="absolute -top-2 left-4 gap-1">
                  <Sparkles className="h-3 w-3" /> Recomendado
                </Badge>
              )}
              <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-bold">{plano.nome}</h2>
                  <p className="font-display text-2xl font-bold tabular-nums">
                    {brl(plano.precoMensal)}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{plano.resumo}</p>
                </div>
                <ul className="flex-1 space-y-2 text-sm">
                  {plano.destaques.map((d) => (
                    <li key={d} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="min-w-0 break-words">{d}</span>
                    </li>
                  ))}
                </ul>
                {atual ? (
                  <div className="space-y-2">
                    <Button className="w-full" variant="outline" disabled>
                      Plano atual
                    </Button>
                    {entitlement.cancelAtPeriodEnd && (
                      <p className="text-xs text-warning-foreground">
                        Assinatura cancelando no fim do período. Reative em “Gerenciar assinatura”.
                      </p>
                    )}
                  </div>
                ) : hasManagedSubscription ? (
                  <Button
                    className="w-full"
                    variant={plano.recomendado ? "default" : "outline"}
                    disabled={ocupado || !stripeConfigurado}
                    onClick={() => {
                      // Founder nunca perde o benefício por um clique comum.
                      if (
                        entitlement.isFounders &&
                        !window.confirm(
                          `Trocar para ${plano.nome} encerra a oferta Founders (R$ 99 com acesso completo). Deseja continuar?`,
                        )
                      ) {
                        return;
                      }
                      trocarPlano.mutate(plano.id);
                    }}
                  >
                    {trocarPlano.isPending ? "Abrindo…" : `Trocar para ${plano.nome}`}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plano.recomendado ? "default" : "outline"}
                    disabled={ocupado || !stripeConfigurado}
                    onClick={() => assinar.mutate(plano.id)}
                  >
                    {assinar.isPending ? "Abrindo…" : "Assinar"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasManagedSubscription && stripeConfigurado && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() => gerenciar.mutate()}
          >
            {gerenciar.isPending ? "Abrindo…" : "Gerenciar assinatura"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Cartão, faturas, cancelamento e reativação ficam no portal de assinatura.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Pagamento processado pela Stripe. Você pode cancelar ou trocar de plano quando quiser em
        Configurações → Assinatura. Cancelamento nunca apaga seus dados.
      </p>
    </div>
  );
}
