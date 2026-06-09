import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Se for colaborador, força /meu-trabalho
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isColab = (roles ?? []).some((r: any) => r.role === "colaborador") &&
                    !(roles ?? []).some((r: any) => r.role === "owner");
    if (isColab && !location.pathname.startsWith("/meu-trabalho")) {
      throw redirect({ to: "/meu-trabalho" });
    }
    return { user: data.user, isColab };
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
