import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeOrders,
  selectOrderPage,
  orderPeriodStart,
  DEFAULT_ORDER_FILTERS,
} from "../src/lib/ordens-model.ts";
const row = (i, patch = {}) => ({
  id: `order-${String(i).padStart(4, "0")}`,
  status: "aguardando",
  valor: 100,
  created_at: "2026-11-21T12:00:00Z",
  checklist_inicial_status: "pendente",
  servico_id: "service-a",
  funcionario_id: null,
  clientes: { nome: "João Silva" },
  servicos: { nome: "Lavagem" },
  veiculos: { placa: "ABC1D23" },
  ...patch,
});
test("Em andamento inclui aguardando/em lavagem/finalização/pronto, não entregue", () => {
  const rows = ["aguardando", "em_lavagem", "finalizacao", "pronto", "entregue"].map((status, i) =>
    row(i, { status }),
  );
  assert.deepEqual(summarizeOrders(rows), {
    total: 5,
    active: 4,
    delivered: 1,
    value: 500,
    pending: 5,
  });
});
test("Valor soma todas as OS do período, não apenas entregues; checklist pulado não é pendente", () => {
  assert.deepEqual(
    summarizeOrders([
      row(1, { valor: 65.5, checklist_inicial_status: "pulado" }),
      row(2, { status: "entregue", valor: 84.5, checklist_inicial_status: "concluido" }),
    ]),
    { total: 2, active: 1, delivered: 1, value: 150, pending: 0 },
  );
});
test("Paginação alcança mais de 200 OS sem perdas ou duplicação", () => {
  const rows = Array.from({ length: 1205 }, (_, i) => row(i));
  const ids = [];
  for (let page = 1; page <= 49; page++)
    ids.push(...selectOrderPage(rows, { ...DEFAULT_ORDER_FILTERS, page }).ids);
  assert.equal(ids.length, 1205);
  assert.equal(new Set(ids).size, 1205);
  const last = selectOrderPage(rows, { ...DEFAULT_ORDER_FILTERS, page: 99 });
  assert.equal(last.page, 49);
  assert.equal(last.ids.length, 5);
  assert.equal(last.total, 1205);
});
test("Pesquisa cliente/serviço/placa/id e filtros contam toda a base", () => {
  const rows = [
    row(1),
    row(2, { funcionario_id: "employee-b", status: "entregue", servico_id: "service-b" }),
  ];
  for (const q of ["joao", "lavagem", "abc1d23", "order-0001"])
    assert.ok(selectOrderPage(rows, { ...DEFAULT_ORDER_FILTERS, q }).ids.includes("order-0001"));
  assert.equal(
    selectOrderPage(rows, {
      ...DEFAULT_ORDER_FILTERS,
      status: "entregue",
      service: "service-b",
      employee: "employee-b",
    }).total,
    1,
  );
  assert.equal(selectOrderPage(rows, { ...DEFAULT_ORDER_FILTERS, employee: "none" }).total, 1);
});
test("Períodos hoje/7/30 usam dias inclusivos em São Paulo; todos não limita", () => {
  const now = new Date("2026-11-21T02:00:00Z");
  assert.equal(orderPeriodStart("today", now), "2026-11-20T03:00:00.000Z");
  assert.equal(orderPeriodStart("7", now), "2026-11-14T03:00:00.000Z");
  assert.equal(orderPeriodStart("30", now), "2026-10-22T03:00:00.000Z");
  assert.equal(orderPeriodStart("all", now), null);
});
test("Ordenação por valor e antigas é estável", () => {
  const rows = [row(1, { valor: 50, created_at: "2026-11-20T12:00:00Z" }), row(2, { valor: 200 })];
  assert.deepEqual(selectOrderPage(rows, { ...DEFAULT_ORDER_FILTERS, sort: "value" }).ids, [
    "order-0002",
    "order-0001",
  ]);
  assert.deepEqual(selectOrderPage(rows, { ...DEFAULT_ORDER_FILTERS, sort: "oldest" }).ids, [
    "order-0001",
    "order-0002",
  ]);
});
