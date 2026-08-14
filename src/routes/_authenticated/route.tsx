import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads (and refreshes) the local session without an extra
    // network round-trip per navigation, while still requiring a valid,
    // non-expired authenticated session before protected routes render.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    if (error || !user) throw redirect({ to: "/auth" });
    return { user };
  },

  // Sem bloqueio global de assinatura: o tier Free opera normalmente.
  // Recursos Growth são protegidos por <FeatureGate> na UI e assertFeature no backend.
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
