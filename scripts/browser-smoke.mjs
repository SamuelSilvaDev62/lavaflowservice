/**
 * Real Chromium smoke of the published guest experience. READ-ONLY:
 * no authentication, booking submissions, payment requests or database writes.
 *
 * Requires playwright module (PLAYWRIGHT_MODULE_URL may point to a temporary
 * isolated install). Run from CI with Node 22+.
 */
import { pathToFileURL } from "node:url";
const moduleUrl = process.env.PLAYWRIGHT_MODULE_URL ||
  pathToFileURL("/tmp/lavaflow-browser-smoke/node_modules/playwright/index.mjs").href;
const { chromium } = await import(moduleUrl);
const origin = "https://lavaflowservice.lovable.app";
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  for (const path of ["/", "/auth", "/lp"]) {
    errors.length = 0;
    let response;
    try {
      response = await page.goto(origin + path, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
      const body = await page.locator("body").innerText();
      const errorBoundary = body.includes("Não foi possível carregar esta página") ||
        body.includes("This page didn't load");
      const httpOk = !!response && response.status() < 400;
      const ok = httpOk && !errorBoundary && errors.length === 0;
      console.log(`${ok ? "PASS" : "FAIL"} browser ${path} HTTP ${response?.status() ?? "none"} final=${page.url()}`);
      if (errorBoundary) console.error("Root error boundary rendered");
      for (const message of errors.slice(0, 3)) console.error("pageerror:", message.slice(0, 400));
      if (!ok) failures.push(path);
    } catch (error) {
      failures.push(path);
      console.error(`FAIL browser ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await page.close();
} finally {
  await browser.close();
}
if (failures.length) {
  console.error("Browser smoke failed for:", failures.join(", "));
  process.exitCode = 1;
}
