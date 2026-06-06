export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const pct = (v: number, digits = 1) =>
  `${(v * 100).toFixed(digits).replace(".", ",")}%`;

export const num = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR").format(Number(v ?? 0));

export const dateBr = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("pt-BR");
};

export const dateTimeBr = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const daysBetween = (a: Date | string, b: Date | string = new Date()) => {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.floor((db.getTime() - da.getTime()) / 86_400_000);
};

export const onlyDigits = (v: string) => v.replace(/\D/g, "");
