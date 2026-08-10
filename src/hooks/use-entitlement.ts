import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMeuPlano } from "@/lib/billing.functions";
import { canUseFeature, getEntitlement, type Entitlement, type FeatureKey } from "@/lib/plans";

const FALLBACK: Entitlement = getEntitlement(null);

/**
 * Plano vigente do estabelecimento.
 *
 * Entitlement é dado de autorização, então não pode ficar "fresco" por minutos no
 * cliente. Um upgrade, downgrade, cancelamento ou webhook pode mudar o acesso a
 * qualquer momento. Revalidamos ao montar/focar antes de liberar telas premium.
 */
export function useEntitlement() {
  const fn = useServerFn(getMeuPlano);
  const q = useQuery({
    queryKey: ["meu-plano"],
    queryFn: () => fn(),
    staleTime: 0,
    gcTime: 10 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });

  // Mesmo que exista um valor em cache, enquanto ele estiver sendo revalidado
  // tratamos o gate como "checando". Isso impede que um dado antigo monte a
  // página premium e dispare uma server function que o backend já bloqueou.
  const isChecking = q.isLoading || q.isFetching;
  const entitlement = (q.data?.entitlement ?? FALLBACK) as Entitlement;

  return {
    entitlement,
    stripeConfigurado: q.data?.stripeConfigurado ?? false,
    isLoading: isChecking,
    isError: q.isError,
    can: (feature: FeatureKey) => canUseFeature(entitlement, feature),
  };
}

export function useFeature(feature: FeatureKey) {
  const { entitlement, isLoading, isError } = useEntitlement();
  return {
    allowed: !isError && canUseFeature(entitlement, feature),
    isLoading,
    isError,
    entitlement,
  };
}
