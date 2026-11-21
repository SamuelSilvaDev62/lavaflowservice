/**
 * Deterministic tenant resolution. Never choose an arbitrary business when an
 * account belongs to multiple tenants. RLS currently has a single active
 * tenant per authenticated user; switching requires a separate RLS design.
 */
export type TenantMembership = {
  owner_id: string;
  role: "owner" | "admin" | "gerente" | "atendente" | "lavador" | "colaborador";
  created_at?: string | null;
};

const priority: Record<TenantMembership["role"], number> = {
  owner: 1, admin: 2, gerente: 3, atendente: 4, lavador: 5, colaborador: 5,
};

export class AmbiguousTenantError extends Error {
  constructor() {
    super("Esta conta está vinculada a mais de uma empresa. A seleção segura de empresa ainda não está disponível.");
    this.name = "AmbiguousTenantError";
  }
}

export function selectTenantMembership(
  userId: string,
  memberships: readonly TenantMembership[],
): { ownerId: string; role: TenantMembership["role"] } {
  const selfOwner = memberships.find(m => m.owner_id === userId && m.role === "owner");
  if (selfOwner) return { ownerId: userId, role: "owner" };

  const owners = new Set(memberships.map(m => m.owner_id));
  if (owners.size > 1) throw new AmbiguousTenantError();

  const current = memberships
    .slice()
    .sort((a, b) =>
      (priority[a.role] - priority[b.role]) ||
      String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
      a.owner_id.localeCompare(b.owner_id)
    )[0];

  return { ownerId: current?.owner_id ?? userId, role: current?.role ?? "owner" };
}
