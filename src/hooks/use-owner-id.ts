import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOwnerId() {
  const q = useQuery({
    queryKey: ["current-owner-id"],
    queryFn: async (): Promise<string | null> => {
      const { data: sess } = await supabase.auth.getUser();
      if (!sess.user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("owner_id")
        .eq("user_id", sess.user.id)
        .limit(1)
        .maybeSingle();
      return (data?.owner_id as string | null) ?? null;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") q.refetch();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ownerId: q.data ?? null, isLoading: q.isLoading };
}
