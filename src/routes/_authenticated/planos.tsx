import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard, Crown, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import { useEntitlement } from "@/hooks/use-entitlement";
import { abrirPortalAssinatura, criarCheckoutAssinatura } from "@/lib/billing.functions";
import { ativarTrialGrowth, getGrowthPreview } from "@/lib/growth.functions";
import { GROWTH_TRIAL_DAYS, STATUS_LABELS, TIERS, tierLabel } from "@/lib/plans";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos LavaFlow — Free organiza, Growth cresce" },
      {
        name: "description",
        content:
          "LavaFlow Free é grátis para sempre para operar seu lava-rápido. Growth por R$ 99/mês transforma seus dados em ações de crescimento.",
      },
      { property: "og:title", content: "Planos LavaFlow — Free e Growth" },
      {
        property: "og:description",
        content: "Free organiza sua operação. Growth encontra as oportunidades de receita.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireRole roles={GESTAO}>
      <PlanosPage />
    </RequireRole>
  ),
});

function dataBr(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function PlanosPage() {
  const qc = useQueryClient();
  const { entitlement, stripeConfigurado, hasManagedSubscription, isLoading } = useEntitlement();

  const previewFn = useServerFn(getGrowthPreview);
  const preview = useQuery({
    queryKey: ["growth-preview"],
    queryFn: () => previewFn(),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const checkoutFn = useServerFn(criarCheckoutAssinatura);
  const portalFn = useServerFn(abrirPortalAssinatura);
  const trialFn = useServerFn(ativarTrialGrowth);

  const checkout = useMutation({
    mutationFn: () => checkoutFn(),
    onSuccess: (r: any) => {
      if (r?.url) window.location.href = r.url;
      else toast.error(r?.motivo ?? "Não foi possível iniciar a assinatura.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar a assinatura"),
  });

  const portal = useMutation({
    mutationFn: () => portalFn(),
    onSuccess: (r: any) => {
      if (r?.url) window.location.href = r.url;
      else toast.error("Não foi possível abrir o portal.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao abrir o portal"),
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

  const noGrowth = entitlement.tier === "growth";
  const trialElegivel = !noGrowth && !entitlement.trialUsado && !!preview.data?.growthReady;

  return (
    <div className="space-y-5">
      <header className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
          Free organiza. Growth encontra oportunidades.
        </p>
        <h1 className="font-display text-2xl font-bold">Planos</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Carregando seu plano…"
            : `Seu plano atual: ${tierLabel(entitlement)} · ${STATUS_LABELS[entitlement.status] ?? entitlement.status}`}
        </p>
      </header>

      {preview.data?.oportunidades?.total ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0 space-y-1">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-primary" />
                {preview.data.oportunidades.total} oportunidades identificadas na sua operação
              </p>
              <p className="text-xs text-muted-foreground">
                Potencial estimado de {brl(preview.data.oportunidades.potencialEstimado)} — estimativa
                a partir do seu ticket médio e histórico, não é receita garantida.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {TIERS.map((t) => {
          const atual = entitlement.tier === t.id;
          return (
            <Card
              key={t.id}
              className={cn(
                "relative flex flex-col",
                t.recomendado && "border-primary/60 ring-1 ring-primary/30",
                atual && "bg-muted/40",
              )}
            >
              {t.recomendado && (
                <Badge className="absolute -top-2 left-4 gap-1">
                  <Sparkles className="h-3 w-3" /> Recomendado
                </Badge>
              )}
              <CardContent className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-lg font-bold">{t.nome}</h2>
                    <span className="font-display font-semibold tabular-nums">
                      {t.precoMensal === 0 ? "R$ 0" : `${brl(t.precoMensal)}/mês`}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.resumo}</p>
                </div>

                <ul className="flex-1 space-y-1.5 text-sm">
                  {t.destaques.map((d: string) => (
                    <li key={d} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="min-w-0 break-words">{d}</span>
                    </li>
                  ))}
                </ul>

                {t.id === "free" ? (
                  <Button variant="outline" disabled className="w-full">
                    {entitlement.tier === "free" ? "Seu plano atual" : "Incluído no Growth"}
                  </Button>
                ) : atual ? (
                  <div className="space-y-2">
                    <Button variant="outline" disabled className="w-full">
                      <Crown className="mr-2 h-4 w-4" />
                      {entitlement.isFounders
                        ? "Founders · acesso completo"
                        : entitlement.isTrial
                          ? `Em teste até ${dataBr(entitlement.trialEndsAt)}`
                          : "Plano atual"}
                    </Button>
                    {entitlement.isTrial && !entitlement.isFounders && (
                      <Button className="w-full" disabled={checkout.isPending} onClick={() => checkout.mutate()}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {checkout.isPending ? "Abrindo…" : "Assinar Growth agora"}
                      </Button>
                    )}
                    {hasManagedSubscription && stripeConfigurado && (
                      <Button
                        variant="ghost"
                        className="w-full"
                        disabled={portal.isPending}
                        onClick={() => portal.mutate()}
                      >
                        {portal.isPending ? "Abrindo…" : "Gerenciar assinatura"}
                      </Button>
                    )}
                    {entitlement.cancelAtPeriodEnd && (
                      <p className="text-xs text-warning-foreground">
                        Cancelamento agendado — acesso Growth até {dataBr(entitlement.currentPeriodEnd)}.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trialElegivel && (
                      <Button
                        className="w-full"
                        disabled={trial.isPending}
                        onClick={() => trial.mutate()}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {trial.isPending
                          ? "Ativando…"
                          : `Testar Growth por ${GROWTH_TRIAL_DAYS} dias sem cartão`}
                      </Button>
                    )}
                    <Button
                      className="w-full"
                      variant={trialElegivel ? "outline" : "default"}
                      disabled={checkout.isPending || !stripeConfigurado}
                      onClick={() => checkout.mutate()}
                    >
                      {!trialElegivel && <Sparkles className="mr-2 h-4 w-4" />}
                      {checkout.isPending
                        ? "Abrindo…"
                        : trialElegivel
                          ? "Assinar Growth agora"
                          : `Assinar Growth · ${brl(t.precoMensal)}/mês`}
                    </Button>
                    {!stripeConfigurado && (
                      <p className="text-xs text-muted-foreground">
                        A cobrança recorrente ainda não está configurada neste ambiente.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        O plano Free é grátis para sempre e nunca bloqueia sua operação. Precisa de ajuda com cobrança?{" "}
        <Link to="/configuracoes" className="underline">
          Configurações → Assinatura
        </Link>
        .
      </p>
    </div>
  );
}
