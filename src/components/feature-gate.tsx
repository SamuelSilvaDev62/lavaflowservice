import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Lock, RefreshCw, Sparkles } from "lucide-react";
import { useFeature } from "@/hooks/use-entitlement";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FEATURE_LABELS, PLANS, requiredPlanFor, type FeatureKey } from "@/lib/plans";

export function UpgradeCard({ feature }: { feature: FeatureKey }) {
  const planoNecessario = requiredPlanFor(feature);
  const plano = PLANS.find((p) => p.id === planoNecessario);
  return (
    <Card className="mx-auto mt-6 max-w-lg">
      <CardContent className="space-y-4 p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold">
            {FEATURE_LABELS[feature]} faz parte do plano {plano?.nome}
          </h2>
          <p className="text-sm text-muted-foreground">
            Seu plano atual não inclui este recurso. Faça upgrade para liberar agora — seus dados
            permanecem como estão.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/planos">
              <Sparkles className="mr-2 h-4 w-4" />
              Ver planos
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EntitlementErrorCard() {
  return (
    <Card className="mx-auto mt-6 max-w-lg">
      <CardContent className="space-y-4 p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold">Não foi possível verificar seu plano</h2>
          <p className="text-sm text-muted-foreground">
            O acesso não foi liberado por segurança. Tente novamente; seus dados e sua assinatura
            não foram alterados.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}

/** Bloqueio elegante de UI. A proteção real também existe no backend. */
export function FeatureGate({
  feature,
  children,
  fallback,
}: {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { allowed, isLoading, isError } = useFeature(feature);
  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;
  if (isError) return <EntitlementErrorCard />;
  if (!allowed) return <>{fallback ?? <UpgradeCard feature={feature} />}</>;
  return <>{children}</>;
}
