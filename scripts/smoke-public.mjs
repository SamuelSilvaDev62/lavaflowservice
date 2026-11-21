/**
 * Read-only HTTP availability smoke. This does NOT verify client-side hydration,
 * login or business workflows. Run browser E2E separately with test accounts.
 * Usage: node scripts/smoke-public.mjs https://lavaflowservice.lovable.app
 */
const origin = process.argv[2] ?? "https://lavaflowservice.lovable.app";
const url = new URL(origin);
if (url.protocol !== "https:") throw new Error("Somente origem HTTPS");
if (url.hostname !== "lavaflowservice.lovable.app") {
  throw new Error("Origem não autorizada para o smoke de produção");
}
const paths = ["/", "/auth", "/lp"];
let failed = false;
for (const path of paths) {
  const target = new URL(path, url);
  try {
    const response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "LavaFlow-CI-Public-SMOKE/1.0" },
    });
    const type = response.headers.get("content-type") ?? "";
    const body = await response.text();
    const genericError = body.includes("This page didn't load") ||
      body.includes("Something went wrong on our end") ||
      body.includes('"unhandled":true');
    const ok = response.ok && type.includes("text/html") && !genericError;
    console.log(`${ok ? "PASS" : "FAIL"} ${path} HTTP ${response.status}, content-type: ${type || "unknown"}, bytes: ${body.length}`);
    if (!ok) failed = true;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (failed) process.exitCode = 1;
