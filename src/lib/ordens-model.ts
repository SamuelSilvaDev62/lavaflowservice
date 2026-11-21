export type OrderStatus = "aguardando" | "em_lavagem" | "finalizacao" | "pronto" | "entregue";
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  aguardando: "Aguardando",
  em_lavagem: "Em lavagem",
  finalizacao: "Finalização",
  pronto: "Pronto",
  entregue: "Entregue",
};
export interface OrderIndex {
  id: string;
  status: OrderStatus;
  valor: number;
  created_at: string;
  checklist_inicial_status: string;
  servico_id: string | null;
  funcionario_id: string | null;
  clientes: { nome: string } | null;
  servicos: { nome: string } | null;
  veiculos: { placa: string } | null;
}
export interface OrderFilters {
  q: string;
  period: string;
  status: string;
  service: string;
  employee: string;
  sort: string;
  page: number;
}
export const DEFAULT_ORDER_FILTERS: OrderFilters = {
  q: "",
  period: "30",
  status: "all",
  service: "all",
  employee: "all",
  sort: "recent",
  page: 1,
};
export const ORDER_PAGE_SIZE = 25;
export function orderPeriodStart(period: string, now = new Date()) {
  if (period === "all") return null;
  const days = period === "today" ? 1 : period === "7" ? 7 : 30;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const start = new Date(`${date}T00:00:00-03:00`);
  start.setTime(start.getTime() - (days - 1) * 86_400_000);
  return start.toISOString();
}
function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
export function selectOrderPage(rows: OrderIndex[], filters: OrderFilters) {
  const needle = normalized(filters.q.trim());
  const matches = rows
    .filter(
      (o) =>
        (filters.status === "all" || o.status === filters.status) &&
        (filters.service === "all" || o.servico_id === filters.service) &&
        (filters.employee === "all" ||
          (filters.employee === "none"
            ? o.funcionario_id === null
            : o.funcionario_id === filters.employee)) &&
        (!needle ||
          normalized(
            [o.id, o.clientes?.nome, o.servicos?.nome, o.veiculos?.placa].filter(Boolean).join(" "),
          ).includes(needle)),
    )
    .sort((a, b) => {
      const comparison =
        filters.sort === "value"
          ? Number(b.valor) - Number(a.valor)
          : filters.sort === "oldest"
            ? a.created_at.localeCompare(b.created_at)
            : b.created_at.localeCompare(a.created_at);
      return comparison || a.id.localeCompare(b.id);
    });
  const total = matches.length;
  const pages = Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, Math.floor(filters.page) || 1));
  return {
    ids: matches.slice((page - 1) * ORDER_PAGE_SIZE, page * ORDER_PAGE_SIZE).map((o) => o.id),
    total,
    pages,
    page,
  };
}
export function summarizeOrders(rows: OrderIndex[]) {
  return rows.reduce(
    (s, o) => ({
      total: s.total + 1,
      active: s.active + (o.status !== "entregue" ? 1 : 0),
      delivered: s.delivered + (o.status === "entregue" ? 1 : 0),
      value: s.value + Number(o.valor),
      pending: s.pending + (o.checklist_inicial_status === "pendente" ? 1 : 0),
    }),
    { total: 0, active: 0, delivered: 0, value: 0, pending: 0 },
  );
}
