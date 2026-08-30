export type ExternalSourceKey = "google_business" | "social" | "local_market" | "events";
export type ExternalSourceReadiness = "not_configured" | "provider_ready" | "verified";

export type ExternalSourceStatus = {
  key: ExternalSourceKey;
  label: string;
  /** Provider credentials/configuration exist on the server. */
  configured: boolean;
  /**
   * Tenant-specific data was actually authorized and verified.
   * Keep this false until a real tenant OAuth/account connection is persisted
   * and successfully fetched. A global API key or OAuth app config is NOT a
   * tenant connection.
   */
  connected: boolean;
  status: ExternalSourceReadiness;
  description: string;
};

function readiness(configured: boolean, connected = false): ExternalSourceReadiness {
  if (connected) return "verified";
  return configured ? "provider_ready" : "not_configured";
}

/**
 * External intelligence readiness.
 *
 * Important distinction:
 * - configured/provider_ready = LavaFlow has server-side provider credentials;
 * - verified/connected = a specific tenant authorized the provider and LavaFlow
 *   successfully fetched that tenant's data.
 *
 * This module must never promote provider readiness to verified business data.
 */
export function getExternalIntelligenceStatus(): ExternalSourceStatus[] {
  const googleBusinessConfigured = Boolean(
    process.env["GOOGLE_BUSINESS_CLIENT_ID"] &&
      process.env["GOOGLE_BUSINESS_CLIENT_SECRET"] &&
      process.env["GOOGLE_BUSINESS_REDIRECT_URI"],
  );
  const localMarketConfigured = Boolean(process.env["GOOGLE_MAPS_API_KEY"]);
  const socialConfigured = Boolean(process.env["META_ACCESS_TOKEN"]);
  const eventsConfigured = Boolean(process.env["EVENTBRITE_API_TOKEN"]);

  // Tenant-specific connection persistence is intentionally not fabricated here.
  // When OAuth storage is added, resolve `connected` from that tenant's record and
  // only set it after a successful provider fetch.
  return [
    {
      key: "google_business",
      label: "Google Business Profile",
      configured: googleBusinessConfigured,
      connected: false,
      status: readiness(googleBusinessConfigured),
      description: "Perfil, reputação e desempenho do negócio mediante autorização OAuth.",
    },
    {
      key: "social",
      label: "Redes sociais",
      configured: socialConfigured,
      connected: false,
      status: readiness(socialConfigured),
      description: "Presença e conteúdo conectado via provedor autorizado.",
    },
    {
      key: "local_market",
      label: "Mercado e concorrência local",
      configured: localMarketConfigured,
      connected: false,
      status: readiness(localMarketConfigured),
      description: "Contexto público de negócios locais via Google Places.",
    },
    {
      key: "events",
      label: "Eventos e acontecimentos locais",
      configured: eventsConfigured,
      connected: false,
      status: readiness(eventsConfigured),
      description: "Eventos relevantes para a região por provedor configurado.",
    },
  ];
}

export function externalIntelligenceSummary() {
  const sources = getExternalIntelligenceStatus();
  return {
    providerAvailable: sources.some((source) => source.configured),
    verifiedAvailable: sources.some((source) => source.connected),
    // Backward-compatible alias: "available" means verified data is available,
    // never merely that a provider credential exists.
    available: sources.some((source) => source.connected),
    sources,
  };
}
