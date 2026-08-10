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
  });

  return {
    entitlement: (q.data?.entitlement ?? FALLBACK) as Entitlement,
    stripeConfigurado: q.data?.stripeConfigurado ?? false,
    isLoading: q.isLoading,
    can: (feature: FeatureKey) => canUseFeature(q.data?.entitlement as Entitlement | undefined, feature),
  };
}

export function useFeature(feature: FeatureKey) {
  const { entitlement, isLoading } = useEntitlement();
  return { allowed: canUseFeature(entitlement, feature), isLoading, entitlement };
}
