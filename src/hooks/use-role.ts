import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getCurrentUserRole } from "@/lib/lavaflow.functions";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/rbac";

export function useRole() {
  const fn = useServerFn(getCurrentUserRole);
  const q = useQuery({
    queryKey: ["current-user-role"],
    queryFn: async () => {
      const r = await fn();
      return (r?.role ?? null) as AppRole | null;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        q.refetch();
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { role: q.data ?? null, isLoading: q.isLoading };
}
