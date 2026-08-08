import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Cached tenant owner id. Invalidated by the root AuthListener on auth changes.
export function useOwnerId() {
  const q = useQuery({
    queryKey: ["current-owner-id"],
    queryFn: async (): Promise<string | null> => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("owner_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      return (data?.owner_id as string | null) ?? null;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  return { ownerId: q.data ?? null, isLoading: q.isLoading };
}
