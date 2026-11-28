/** Policy input must come from a tenant-scoped backend read, never user input. */
export function assertDemoActionAllowed(isDemo: boolean, action: "billing" | "automatic_message") {
  if (!isDemo) return;
  throw new Error(
    action === "billing"
      ? "Esta conta de demonstração tem Growth permanente e não permite cobrança."
      : "Disparos automáticos estão bloqueados para contas de demonstração.",
  );
}
