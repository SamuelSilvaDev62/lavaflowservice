import test from "node:test";
import assert from "node:assert/strict";
import { canAdvanceWorkOrder, WORK_ORDER_STAGES } from "../src/lib/os-transitions.ts";

test("a OS pode avançar e repetir a mesma atualização com segurança", () => {
  for (let i = 0; i < WORK_ORDER_STAGES.length; i++) {
    for (let j = i; j < WORK_ORDER_STAGES.length; j++) {
      assert.equal(canAdvanceWorkOrder(WORK_ORDER_STAGES[i], WORK_ORDER_STAGES[j]), true);
    }
  }
});

test("não permite retrocesso nem reabrir OS entregue", () => {
  for (let i = 1; i < WORK_ORDER_STAGES.length; i++) {
    for (let j = 0; j < i; j++) {
      assert.equal(canAdvanceWorkOrder(WORK_ORDER_STAGES[i], WORK_ORDER_STAGES[j]), false);
    }
  }
});

test("estados inexistentes são rejeitados", () => {
  assert.equal(canAdvanceWorkOrder("entregue", "cancelado"), false);
  assert.equal(canAdvanceWorkOrder("cancelado", "entregue"), false);
});
