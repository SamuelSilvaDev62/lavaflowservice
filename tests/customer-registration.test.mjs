import test from "node:test";
import assert from "node:assert/strict";
import { customerRegistrationSchema, matchesCustomer, submissionGuard } from "../src/lib/customer-registration.ts";

const customer = { id: "synthetic", nome: "Cláudia Teste", telefone: "(11) 90000-0123" };
test("Pesquisa encontra cliente pelo nome com ou sem acento", () => {
  assert.equal(matchesCustomer(customer, "claudia"), true);
  assert.equal(matchesCustomer(customer, "outra pessoa"), false);
});
test("Pesquisa encontra cliente pelo telefone sem formatação", () => {
  assert.equal(matchesCustomer(customer, "900000123"), true);
  assert.equal(matchesCustomer(customer, "999999999"), false);
});
test("Cadastro rejeita nome vazio e preserva limites existentes", () => {
  assert.equal(customerRegistrationSchema.safeParse({ nome: "   " }).success, false);
  assert.equal(customerRegistrationSchema.safeParse({ nome: "x".repeat(121) }).success, false);
  assert.equal(customerRegistrationSchema.safeParse({ nome: "Teste", telefone: "1".repeat(21) }).success, false);
  assert.equal(customerRegistrationSchema.parse({ nome: " Teste " }).nome, "Teste");
});
test("Cliques simultâneos iniciam somente um cadastro e falha permite nova tentativa", () => {
  const guard = submissionGuard();
  assert.equal(guard.enter(), true);
  assert.equal(guard.enter(), false);
  guard.release();
  assert.equal(guard.enter(), true);
});