import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { canAny, type AppRole } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";

export function RequireRole({
  roles,
  children,
  fallback,
}: {
  roles: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role, isLoading } = useRole();
  if (isLoading) return <div className="h-40 rounded-xl bg-muted animate-pulse" />;
  if (!canAny(role, roles)) {
    return (
      fallback ?? (
        <Card className="max-w-md mx-auto mt-10">
          <CardContent className="p-6 text-center space-y-2">
            <ShieldAlert className="h-10 w-10 mx-auto text-warning" />
            <h2 className="font-display text-lg font-semibold">Sem permissão</h2>
            <p className="text-sm text-muted-foreground">
              Esta área é restrita ao seu perfil. Peça acesso ao proprietário do lava-rápido.
            </p>
          </CardContent>
        </Card>
      )
    );
  }
  return <>{children}</>;
}
