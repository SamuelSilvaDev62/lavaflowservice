import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlement } from "@/hooks/use-entitlement";
import { criarCheckoutAssinatura } from "@/lib/billing.functions";
import { PLANS, STATUS_LABELS, planLabel, type PlanId } from "@/lib/plans";
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
  const { entitlement, stripeConfigurado } = useEntitlement();
  const checkout = useServerFn(criarCheckoutAssinatura);

  const mut = useMutation({
    mutationFn: ({ plan, founders = false }: { plan: PlanId; founders?: boolean }) =>
      checkout({ data: { plan, founders } }),
    onSuccess: (r: any) => {
      if (r?.url) window.location.href = r.url;
      else toast.error("Não foi possível abrir a cobrança.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar assinatura"),
  });

  const possuiAssinaturaStripe =
    entitlement.hasCustomer && !!entitlement.planoAssinado && entitlement.ativo;
  const podeContratarFounders = entitlement.isFounders && !possuiAssinaturaStripe;

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

      {podeContratarFounders && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <h2 className="font-display font-semibold">Sua oferta Founders está disponível</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Acesso completo equivalente ao Intelligence por {brl(99)}/mês. Esta oferta não é um quarto plano público.
              </p>
            </div>
            <Button
              className="shrink-0"
              disabled={mut.isPending || !stripeConfigurado}
              onClick={() => mut.mutate({ plan: "intelligence", founders: true })}
            >
              {mut.isPending ? "Abrindo…" : "Assinar Founders · R$ 99"}
            </Button>
          </CardContent>
        </Card>
      )}

      {possuiAssinaturaStripe && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Você já possui uma assinatura Stripe. Alterações de plano e cobrança são feitas pelo
            portal seguro da Stripe para evitar assinaturas duplicadas.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plano) => {
          const atual = !entitlement.isFounders && entitlement.planoAssinado === plano.id;
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
                <Button
                  className="w-full"
                  variant={plano.recomendado ? "default" : "outline"}
                  disabled={atual || mut.isPending || !stripeConfigurado}
                  onClick={() => mut.mutate({ plan: plano.id, founders: false })}
                >
                  {atual
                    ? "Plano atual"
                    : mut.isPending
                      ? "Abrindo…"
                      : possuiAssinaturaStripe
                        ? "Gerenciar / trocar"
                        : `Assinar ${plano.nome}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Pagamento processado pela Stripe. Você pode cancelar ou trocar de plano pelo Customer Portal
        em Configurações → Assinatura. Cancelamento nunca apaga seus dados.
      </p>
    </div>
  );
}
