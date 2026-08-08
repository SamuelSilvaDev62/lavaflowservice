import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserRole } from "@/lib/lavaflow.functions";
import type { AppRole } from "@/lib/rbac";

// Single cached source of truth for the current user's role.
// Auth changes invalidate this key from the root AuthListener — this hook
// intentionally does NOT register its own auth listener.
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

  return { role: q.data ?? null, isLoading: q.isLoading };
}
