import test from "node:test";
import assert from "node:assert/strict";
import { countOperationStages, appointmentForecast } from "../src/lib/dashboard-metrics.ts";

test("count all OS stages without truncation", () => {
  const os = [...Array(9)].map(() => ({ status: "aguardando" }));
  os.push({status:"em_lavagem"},{status:"finalizacao"},{status:"pronto"});
  assert.deepEqual(countOperationStages(os), {
    aguardando:9,em_lavagem:1,finalizacao:1,pronto:1
  });
});
test("unknown or completed statuses do not leak into open-stage totals", () => {
  assert.deepEqual(countOperationStages([{status:"entregue"},{status:"cancelado"},{}]), {
    aguardando:0,em_lavagem:0,finalizacao:0,pronto:0
  });
});
test("forecast sums only active bookings; OS amounts are not counted again", () => {
  const agenda = [
    {status:"confirmado",servicos:{preco_padrao:65},taxa_leva_traz:0},
    {status:"agendado",servicos:{preco_padrao:85},taxa_leva_traz:12},
    {status:"cancelado",servicos:{preco_padrao:999},taxa_leva_traz:0},
  ];
  assert.equal(appointmentForecast(agenda),162);
});
