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
    mutationFn: (plan: PlanId) => checkout({ data: { plan, founders: entitlement.isFounders } }),
    onSuccess: (r: any) => {
      if (r?.url) window.location.href = r.url;
      else toast.error("Não foi possível abrir o checkout.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar assinatura"),
  });

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
          const atual = entitlement.planoAssinado === plano.id;
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
                  onClick={() => mut.mutate(plano.id)}
                >
                  {atual ? "Plano atual" : mut.isPending ? "Abrindo…" : "Assinar"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Pagamento processado pela Stripe. Você pode cancelar ou trocar de plano quando quiser em
        Configurações → Assinatura. Cancelamento nunca apaga seus dados.
      </p>
    </div>
  );
}
