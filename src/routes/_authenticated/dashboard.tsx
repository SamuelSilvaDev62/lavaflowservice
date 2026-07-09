import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/require-role";
import { GESTAO } from "@/lib/rbac";
import { Dashboard } from "@/components/dashboard/dashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => (
    <RequireRole roles={GESTAO}>
      <Dashboard />
    </RequireRole>
  ),
});
