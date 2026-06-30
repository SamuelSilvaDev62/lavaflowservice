import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/app-layout";
import { ContextualCopilot } from "@/components/copilot/contextual-copilot";
import { isMvpMode, MVP_ALLOWED_ROUTES } from "@/lib/mvp-mode";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Detecta papel mais restrito (lavador/colaborador) e força /meu-trabalho
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const list = (roles ?? []).map((r: any) => r.role as string);
    const isColab = list.length > 0
      && list.every((r) => r === "lavador" || r === "colaborador");
    if (isColab && !location.pathname.startsWith("/meu-trabalho")) {
      throw redirect({ to: "/meu-trabalho" });
    }
    return { user: data.user, isColab };
  },
  component: () => (
    <AppLayout>
      <Outlet />
      <ContextualCopilot />
    </AppLayout>
  ),
});
