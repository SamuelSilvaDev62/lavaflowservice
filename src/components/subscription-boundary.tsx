import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CreditCard, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlement } from "@/hooks/use-entitlement";
import { abrirPortalAssinatura } from "@/lib/billing.functions";
import { STATUS_LABELS } from "@/lib/plans";

/** Rotas sempre acessíveis para recuperação da conta (assinar / pagar / sair). */
const ROTAS_LIVRES = ["/planos"];

function isRotaLivre(pathname: string) {
  return ROTAS_LIVRES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/**
 * Bloqueio global de operação: sem trial nem assinatura válida, a operação
 * normal não é renderizada. Fail closed — erro ao consultar o entitlement
 * também bloqueia. Nenhum dado do estabelecimento é apagado.
 */
export function SubscriptionBoundary({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { entitlement, isLoading, isError, refetch, hasManagedSubscription, stripeConfigurado } =
    useEntitlement();

  if (isRotaLivre(pathname)) return <>{children}</>;
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <BloqueioCard
        icon={AlertTriangle}
        titulo="Não conseguimos confirmar sua assinatura"
        descricao="Por segurança, a operação fica indisponível até confirmarmos o status do seu plano. Seus dados continuam salvos."
        acoes={
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        }
      />
    );
  }

  if (!entitlement.ativo) {
    return (
      <BloqueioCard
        icon={CreditCard}
        titulo={
          entitlement.status === "none"
            ? "Ative um plano para começar a operar"
            : "Sua assinatura precisa de atenção"
        }
        descricao={`Status atual: ${STATUS_LABELS[entitlement.status] ?? entitlement.status}. Nenhum dado do seu estabelecimento foi apagado — assim que o pagamento for regularizado, tudo volta exatamente como está.`}
        acoes={
          <>
            <Button asChild>
              <Link to="/planos">
                <Sparkles className="mr-2 h-4 w-4" /> Ver planos
              </Link>
            </Button>
            {hasManagedSubscription && stripeConfigurado && <BotaoPortal />}
          </>
        }
      />
    );
  }

  return <>{children}</>;
}

function BotaoPortal() {
  const portal = useServerFn(abrirPortalAssinatura);
  const mut = useMutation({
    mutationFn: () => portal(),
    onSuccess: (r: any) => {
      if (r?.url) window.location.href = r.url;
      else toast.error("Não foi possível abrir o portal.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao abrir o portal"),
  });
  return (
    <Button variant="outline" disabled={mut.isPending} onClick={() => mut.mutate()}>
      <CreditCard className="mr-2 h-4 w-4" />
      {mut.isPending ? "Abrindo…" : "Gerenciar assinatura"}
    </Button>
  );
}

function BloqueioCard({
  icon: Icon,
  titulo,
  descricao,
  acoes,
}: {
  icon: any;
  titulo: string;
  descricao: string;
  acoes: ReactNode;
}) {
  return (
    <Card className="mx-auto mt-4 max-w-xl">
      <CardContent className="space-y-4 p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-content-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">{acoes}</div>
      </CardContent>
    </Card>
  );
}
