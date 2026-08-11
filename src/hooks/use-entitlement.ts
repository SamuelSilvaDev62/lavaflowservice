import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeuPlano } from "@/lib/billing.functions";
import { canUseFeature, getEntitlement, type Entitlement, type FeatureKey } from "@/lib/plans";

const FALLBACK: Entitlement = getEntitlement(null);

/** Plano vigente do estabelecimento (cacheado). */
export function useEntitlement() {
  const fn = useServerFn(getMeuPlano);
  const q = useQuery({
    queryKey: ["meu-plano"],
    queryFn: () => fn(),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });

  // Fail closed: erro ao consultar entitlement nunca libera recurso premium.
  const entitlement = (q.isError ? FALLBACK : (q.data?.entitlement ?? FALLBACK)) as Entitlement;

  return {
    entitlement,
    stripeConfigurado: q.data?.stripeConfigurado ?? false,
    hasManagedSubscription: q.data?.assinaturaGerenciavel ?? false,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
    can: (feature: FeatureKey) => (q.isError ? false : canUseFeature(entitlement, feature)),
  };
}

export function useFeature(feature: FeatureKey) {
  const { entitlement, isLoading, isError, can } = useEntitlement();
  return { allowed: can(feature), isLoading, isError, entitlement };
}
