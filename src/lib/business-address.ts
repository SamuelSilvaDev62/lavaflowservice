/** Structured address UI model. Persisted as a single formatted address
 * string for backward compatibility with existing public booking + WhatsApp.
 * No schema migration required.
 */
export type BusinessAddress = {
  cep: string; rua: string; numero: string; complemento: string;
  bairro: string; cidade: string; uf: string;
};
export const EMPTY_BUSINESS_ADDRESS: BusinessAddress = {
  cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
};
export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? digits.slice(0, 5) + "-" + digits.slice(5) : digits;
}
export function validAddress(value: BusinessAddress): boolean {
  return !!(value.rua.trim() && value.numero.trim() && value.bairro.trim() &&
    value.cidade.trim() && /^[A-Za-z]{2}$/.test(value.uf.trim()) &&
    (!value.cep || /^\d{5}-\d{3}$/.test(formatCep(value.cep))));
}
export function formatBusinessAddress(value: BusinessAddress): string {
  const normalized = {
    rua: value.rua.trim(), numero: value.numero.trim(),
    complemento: value.complemento.trim(), bairro: value.bairro.trim(),
    cidade: value.cidade.trim(), uf: value.uf.trim().toUpperCase(),
    cep: formatCep(value.cep),
  };
  const street = [normalized.rua, normalized.numero].filter(Boolean).join(", ");
  const complement = normalized.complemento ? " (" + normalized.complemento + ")" : "";
  const neighborhood = normalized.bairro ? " - " + normalized.bairro : "";
  const municipality = [normalized.cidade, normalized.uf].filter(Boolean).join(" - ");
  const tail = [street + complement + neighborhood, municipality].filter(Boolean).join(", ");
  return tail + (normalized.cep ? ", CEP " + normalized.cep : "");
}

/** Round-trips new records only; legacy strings must never be re-serialized silently. */
export function parseBusinessAddress(value: string | null | undefined): BusinessAddress | null {
  if (!value) return null;
  const match = /^(.+?), ([^,()]+?)(?: \(([^()]*)\))? - (.+?), (.+?) - ([A-Za-z]{2})(?:, CEP (\d{5}-\d{3}))?$/.exec(value.trim());
  if (!match) return null;
  const address: BusinessAddress = {
    rua: match[1], numero: match[2], complemento: match[3] ?? "",
    bairro: match[4], cidade: match[5], uf: match[6].toUpperCase(), cep: match[7] ?? "",
  };
  return validAddress(address) ? address : null;
}
export type CepLookup = {
  cep?: string; logradouro?: string; bairro?: string; localidade?: string;
  uf?: string; erro?: boolean | string;
};
export function applyCepLookup(previous: BusinessAddress, lookup: CepLookup): BusinessAddress {
  if (lookup.erro) return previous;
  return {
    ...previous,
    cep: formatCep(lookup.cep ?? previous.cep),
    rua: lookup.logradouro?.trim() || previous.rua,
    bairro: lookup.bairro?.trim() || previous.bairro,
    cidade: lookup.localidade?.trim() || previous.cidade,
    uf: lookup.uf?.trim().toUpperCase() || previous.uf,
    // Number and complement are always entered by the business owner.
  };
}
