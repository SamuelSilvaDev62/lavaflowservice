import test from "node:test";
import assert from "node:assert/strict";
import { getEntitlement, GROWTH_FEATURES, canUseFeature } from "../src/lib/plans.ts";
import { assertDemoActionAllowed } from "../src/lib/demo-policy.ts";
import { fetchEntitlement } from "../src/lib/entitlements.server.ts";
import { assertAutomaticMessagingAllowed } from "../src/lib/demo-policy.server.ts";

test("demo has every Growth feature without trial or expiry even with an expired subscription", () => {
  const e = getEntitlement({
    is_demo: true,
    plan: null,
    subscription_status: "canceled",
    is_founders: false,
    trial_ends_at: "2000-01-01",
    current_period_end: "2000-01-01",
  });
  assert.equal(e.tier, "growth");
  assert.equal(e.isDemo, true);
  assert.equal(e.isTrial, false);
  assert.equal(e.trialEndsAt, null);
  assert.equal(e.currentPeriodEnd, null);
  assert.equal(e.status, "demo");
  for (const feature of GROWTH_FEATURES) assert.equal(canUseFeature(e, feature), true, feature);
});
test("other tenants retain their plan rules", () => {
  assert.equal(getEntitlement(null).tier, "free");
  assert.equal(
    getEntitlement({
      is_demo: false,
      plan: null,
      subscription_status: "trialing",
      is_founders: false,
    }).tier,
    "free",
  );
  assert.equal(
    getEntitlement({
      is_demo: false,
      plan: "growth",
      subscription_status: "active",
      is_founders: false,
    }).tier,
    "growth",
  );
});
test("demo cannot be charged or automatically message any recipient", () => {
  assert.throws(() => assertDemoActionAllowed(true, "billing"), /não permite cobrança/);
  assert.throws(() => assertDemoActionAllowed(true, "automatic_message"), /bloqueados/);
  assert.doesNotThrow(() => assertDemoActionAllowed(false, "billing"));
  assert.doesNotThrow(() => assertDemoActionAllowed(false, "automatic_message"));
});
test("demo entitlement and automatic-send preflight read only the explicit tenant and fail closed", async () => {
  const filters = [];
  let fail = false;
  const client = {
    from(table) {
      assert.equal(table, "tenant_subscriptions");
      return {
        select() {
          return this;
        },
        eq(key, value) {
          filters.push([key, value]);
          return this;
        },
        async maybeSingle() {
          return { data: { is_demo: true }, error: fail ? { code: "42501" } : null };
        },
      };
    },
  };
  assert.equal((await fetchEntitlement(client, "demo-tenant")).isDemo, true);
  await assert.rejects(assertAutomaticMessagingAllowed(client, "demo-tenant"), /bloqueados/);
  assert.deepEqual(filters, [
    ["owner_id", "demo-tenant"],
    ["owner_id", "demo-tenant"],
  ]);
  fail = true;
  await assert.rejects(assertAutomaticMessagingAllowed(client, "demo-tenant"), /consultar o plano/);
});
