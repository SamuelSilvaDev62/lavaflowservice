import test from "node:test";
import assert from "node:assert/strict";
import {
  getEntitlement,
  canUseFeature,
  GROWTH_PRICE_BRL,
  GROWTH_PRICE_CENTS,
} from "../src/lib/plans.ts";

const dateFromNow = (days) => new Date(Date.now() + days * 86400000).toISOString();
const active = (plan = "growth") => ({plan, subscription_status: "active", is_founders: false});

test("Free remains usable with no subscription, Growth fails closed", () => {
  const entitlement = getEntitlement(null);
  assert.equal(entitlement.tier, "free");
  assert.equal(canUseFeature(entitlement, "clientes"), true);
  assert.equal(canUseFeature(entitlement, "agendamentos"), true);
  assert.equal(canUseFeature(entitlement, "ai_assistant"), false);
  assert.equal(canUseFeature(undefined, "campanhas"), false);
});

test("Paid Growth grants growth features and preserves price invariants", () => {
  const entitlement = getEntitlement(active());
  assert.equal(entitlement.tier, "growth");
  assert.equal(canUseFeature(entitlement, "campanhas"), true);
  assert.equal(canUseFeature(entitlement, "ai_assistant"), true);
  assert.equal(GROWTH_PRICE_BRL * 100, GROWTH_PRICE_CENTS);
});

test("Legacy active paid subscriptions preserve Growth access", () => {
  for (const plan of ["essencial", "intelligence"]) {
    const entitlement = getEntitlement(active(plan));
    assert.equal(entitlement.tier, "growth");
    assert.equal(entitlement.growthCompat, true);
  }
});

test("Canceled and malformed subscriptions cannot grant Growth", () => {
  for (const row of [
    { ...active(), subscription_status: "canceled" },
    { ...active(), plan: null },
    { ...active(), subscription_status: "incomplete_expired" }
  ]) {
    assert.equal(getEntitlement(row).tier, "free");
  }
});

test("A valid seven-day contextual trial grants temporary Growth", () => {
  const entitlement = getEntitlement({
    ...active(),
    subscription_status: "trialing",
    updated_at: dateFromNow(-1),
    trial_ends_at: dateFromNow(6),
  });
  assert.equal(entitlement.isTrial, true);
  assert.equal(entitlement.growthActive, true);
});

test("Expired, too-long, and legacy trials do not grant Growth", () => {
  const base = { ...active(), subscription_status: "trialing" };
  assert.equal(getEntitlement({ ...base, updated_at: dateFromNow(-8), trial_ends_at: dateFromNow(-1) }).tier, "free");
  assert.equal(getEntitlement({ ...base, updated_at: dateFromNow(-1), trial_ends_at: dateFromNow(13) }).tier, "free");
  assert.equal(getEntitlement({ ...base, plan: "essencial", updated_at: dateFromNow(-1), trial_ends_at: dateFromNow(6) }).tier, "free");
});

test("Grace period is finite for past-due plans", () => {
  assert.equal(getEntitlement({ ...active(), subscription_status: "past_due", current_period_end: dateFromNow(-2) }).tier, "growth");
  assert.equal(getEntitlement({ ...active(), subscription_status: "past_due", current_period_end: dateFromNow(-9) }).tier, "free");
});
