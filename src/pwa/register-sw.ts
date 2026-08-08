// Guarded service-worker registration wrapper.
// Only registers on the published production site. Never in dev, Lovable
// preview, iframes, or when ?sw=off is set.

const SW_URL = "/sw.js";
const RELOAD_GUARD_KEY = "lavaflow:sw-reloaded";

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const { hostname, search } = window.location;
  if (search.includes("sw=off")) return true;
  if (hostname.startsWith("id-preview--")) return true;
  if (hostname.startsWith("preview--")) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
      if (url.endsWith(SW_URL)) await reg.unregister();
    }
  } catch {
    /* ignore */
  }
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    void unregisterMatching();
    return;
  }

  // Single-reload guard: when a new worker takes control after an update,
  // reload once so the page is not left referencing evicted chunks.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    try {
      if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
      sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
    } catch {
      return; // no storage => never auto-reload (avoids loops)
    }
    window.location.reload();
  });

  window.addEventListener("load", () => {
    // updateViaCache: "none" => the SW script itself is never served from the
    // HTTP cache, so deploys are picked up on the first visit.
    navigator.serviceWorker
      .register(SW_URL, { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        void reg.update();
      })
      .catch(() => {
        /* ignore */
      });
  });
}
