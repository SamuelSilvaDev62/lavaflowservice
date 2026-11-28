import { fetchEntitlement } from "@/lib/entitlements.server";
import { assertDemoActionAllowed } from "@/lib/demo-policy";

/** Mandatory preflight for any future provider/queue/cron message delivery. */
export async function assertAutomaticMessagingAllowed(
  supabase: Parameters<typeof fetchEntitlement>[0],
  ownerId: string,
) {
  const entitlement = await fetchEntitlement(supabase, ownerId);
  assertDemoActionAllowed(entitlement.isDemo, "automatic_message");
}
