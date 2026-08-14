import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeuPlano } from "@/lib/billing.functions";
import { canUseFeature, getEntitlement, type Entitlement, type FeatureKey } from "@/lib/plans";

/** Estado seguro: Free. Operação núcleo continua liberada. */
const FALLBACK: Entitlement = getEntitlement(null);

/** Tier vigente do estabelecimento (cacheado). */
export function useEntitlement() {
  const fn = useServerFn(getMeuPlano);
  const q = useQuery({
    queryKey: ["meu-plano"],
    queryFn: () => fn(),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });

  // Fail closed apenas para Growth: erro de leitura nunca libera premium,
  // mas também não bloqueia o núcleo Free (features Free passam sempre).
  const entitlement = (q.isError ? FALLBACK : (q.data?.entitlement ?? FALLBACK)) as Entitlement;

  return {
    entitlement,
    tier: entitlement.tier,
    growthActive: entitlement.growthActive,
    stripeConfigurado: q.data?.stripeConfigurado ?? false,
    hasManagedSubscription: q.data?.assinaturaGerenciavel ?? false,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
    can: (feature: FeatureKey) => canUseFeature(entitlement, feature),
  };
}

export function useFeature(feature: FeatureKey) {
  const { entitlement, isLoading, isError, can } = useEntitlement();
  return { allowed: can(feature), isLoading, isError, entitlement };
}
