import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, CreditCard, RefreshCw } from "lucide-react";
import { useEntitlement } from "@/hooks/use-entitlement";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const BILLING_ROUTES = ["/planos"];

function isBillingRoute(pathname: string) {
  return BILLING_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Gate global da área autenticada.
 *
 * FeatureGate continua responsável por diferenciar Essencial/Growth/Intelligence.
 * Este boundary resolve uma camada anterior: sem assinatura/trial válido, nenhuma
 * operação paga deve renderizar. A tela de Planos permanece acessível para que o
 * proprietário consiga iniciar ou regularizar a assinatura.
 */
export function SubscriptionBoundary({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { entitlement, isLoading, isError } = useEntitlement();

  if (isBillingRoute(pathname)) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-56 rounded-xl skeleton-shimmer" />
        <div className="h-52 rounded-2xl skeleton-shimmer" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="mx-auto mt-8 max-w-xl">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Não foi possível verificar sua assinatura</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Por segurança, a operação fica temporariamente bloqueada até conseguirmos confirmar o plano. Seus dados não são alterados.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
            <Button asChild><Link to="/planos">Ver planos</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!entitlement.ativo || !entitlement.plan) {
    return (
      <Card className="mx-auto mt-8 max-w-xl">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-primary/10 text-primary">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Escolha um plano para continuar</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Seu período de acesso terminou ou não há uma assinatura ativa. Seus clientes, ordens, agenda e configurações continuam salvos.
            </p>
          </div>
          <Button asChild><Link to="/planos">Ver planos do LavaFlow</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
