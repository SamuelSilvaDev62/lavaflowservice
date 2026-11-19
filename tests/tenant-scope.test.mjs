import test from "node:test";
import assert from "node:assert/strict";
import { selectTenantMembership, AmbiguousTenantError } from "../src/lib/tenant-scope.ts";

const membership = (owner_id, role, created_at) => ({owner_id, role, created_at});

test("single membership resolves owner and role", () => {
  assert.deepEqual(selectTenantMembership("user", [membership("business-a","atendente")]), {ownerId:"business-a",role:"atendente"});
});

test("self-owned business takes precedence over any external membership, matching existing RLS behavior", () => {
  assert.deepEqual(selectTenantMembership("user", [
    membership("business-b","admin"),
    membership("user","owner")
  ]), {ownerId:"user",role:"owner"});
});

test("multiple roles in the same business select the strongest role", () => {
  assert.deepEqual(selectTenantMembership("user", [
    membership("business-a","atendente"),
    membership("business-a","gerente")
  ]), {ownerId:"business-a",role:"gerente"});
});

test("multiple external businesses fail closed instead of selecting a random tenant", () => {
  assert.throws(() => selectTenantMembership("user", [
    membership("business-a","admin"),
    membership("business-b","gerente")
  ]), AmbiguousTenantError);
});

test("empty memberships preserve existing own-account bootstrap", () => {
  assert.deepEqual(selectTenantMembership("user", []), {ownerId:"user",role:"owner"});
});

test("input order does not affect ambiguous selection", () => {
  const roles=[membership("a","lavador"),membership("b","admin")];
  assert.throws(()=>selectTenantMembership("u",roles),AmbiguousTenantError);
  assert.throws(()=>selectTenantMembership("u",roles.reverse()),AmbiguousTenantError);
});
