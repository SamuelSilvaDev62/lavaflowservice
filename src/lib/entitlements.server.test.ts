import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fetchEntitlement } from "./entitlements.server";

function tenantClient(data: unknown, error: unknown = null) {
  const filters: Array<[string, string]> = [];
  const client = {
    from(table: string) {
      assert.equal(table, "tenant_subscriptions");
      return {
        select() { return this; },
        eq(column: string, value: string) { filters.push([column, value]); return this; },
        async maybeSingle() { return { data, error }; },
      };
    },
  };
  return { client, filters };
}

describe("consulta de plano com cliente autenticado", () => {
  test("consulta apenas o tenant resolvido sem chave de serviço", async () => {
    const { client, filters } = tenantClient({ plan: "growth", subscription_status: "active" });
    const entitlement = await fetchEntitlement(client, "tenant-a");
    assert.deepEqual(filters, [["owner_id", "tenant-a"]]);
    assert.equal(entitlement.tier, "growth");
  });

  test("tenant sem assinatura permanece Free", async () => {
    const { client } = tenantClient(null);
    assert.equal((await fetchEntitlement(client, "tenant-b")).tier, "free");
  });

  test("erro de consulta não concede acesso premium", async () => {
    const { client } = tenantClient({ plan: "growth", subscription_status: "active" }, { code: "42501" });
    await assert.rejects(fetchEntitlement(client, "tenant-a"), /Não foi possível consultar o plano/);
  });
});