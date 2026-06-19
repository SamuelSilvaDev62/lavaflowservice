export type AppRole = "owner" | "admin" | "gerente" | "atendente" | "lavador" | "colaborador";

// Conjuntos canônicos de permissão usados no front
export const ADMINS: AppRole[] = ["owner", "admin"];
export const GESTAO: AppRole[] = ["owner", "admin", "gerente"];
export const OPERACIONAL: AppRole[] = ["owner", "admin", "gerente", "atendente"];
export const COLABORADORES: AppRole[] = ["lavador", "colaborador"];
export const TODOS: AppRole[] = ["owner", "admin", "gerente", "atendente", "lavador", "colaborador"];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  gerente: "Gerente",
  atendente: "Atendente",
  lavador: "Lavador",
  colaborador: "Lavador",
};

export function isColaborador(role?: AppRole | null) {
  return role === "lavador" || role === "colaborador";
}

export function canAny(role: AppRole | null | undefined, roles: AppRole[]) {
  if (!role) return false;
  return roles.includes(role);
}
