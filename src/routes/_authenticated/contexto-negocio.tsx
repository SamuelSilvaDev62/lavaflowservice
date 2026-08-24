import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-layout";
import { ContextoNegocioTab } from "@/components/configuracoes/contexto-negocio-tab";
import { RequireRole } from "@/components/require-role";
import { ADMINS } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/contexto-negocio")({
  component: () => (
    <RequireRole roles={ADMINS}>
      <ContextoNegocioPage />
    </RequireRole>
  ),
});

function ContextoNegocioPage() {
  return (
    <>
      <PageHeader
        title="Contexto do Negócio"
        subtitle="Ensine ao LavaFlow como sua empresa se posiciona, comunica e atende."
      />
      <ContextoNegocioTab />
    </>
  );
}
