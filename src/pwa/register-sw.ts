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

/** Caches legítimos deste build. Qualquer outro é shell/asset de deploy antigo. */
const CACHE_ALLOWLIST = [/^workbox-precache/, /^static-assets$/, /^gstatic-fonts$/];

/**
 * Remove apenas Cache Storage obsoleto (app-shell/assets de deploys antigos).
 * Nunca toca em localStorage/sessionStorage/IndexedDB — sessão e dados do
 * usuário permanecem intactos.
 */
async function purgeStaleCaches() {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => !CACHE_ALLOWLIST.some((re) => re.test(name)))
        .map((name) => caches.delete(name)),
    );
  } catch {
    /* ignore */
  }
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    void unregisterMatching();
    void purgeStaleCaches();
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
        void purgeStaleCaches();
        // Checa atualização ao voltar para o app (deploy novo sem F5 manual).
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update();
        });
      })
      .catch(() => {
        /* ignore */
      });
  });
}
