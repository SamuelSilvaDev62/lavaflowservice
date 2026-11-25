import { z } from "zod";

export const customerRegistrationSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do cliente.").max(120),
  telefone: z.string().max(20).optional().nullable(),
  origem_cliente: z.string().max(50).optional().nullable(),
});

export type RegisteredCustomer = { id: string; nome: string; telefone: string | null };

export function matchesCustomer(customer: RegisteredCustomer, query: string) {
  const normalize = (value: string) =>
    value
      .trim()
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const digits = query.replace(/\D/g, "");
  return (
    !query.trim() ||
    normalize(customer.nome).includes(normalize(query)) ||
    (!!digits && (customer.telefone ?? "").replace(/\D/g, "").includes(digits))
  );
}

/** Synchronous guard: React pending state alone cannot exclude same-tick submissions. */
export function submissionGuard() {
  let busy = false;
  return {
    enter() {
      if (busy) return false;
      busy = true;
      return true;
    },
    release() {
      busy = false;
    },
  };
}
