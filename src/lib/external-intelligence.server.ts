export type ExternalSourceKey = "google_business" | "social" | "local_market" | "events";

export type ExternalSourceStatus = {
  key: ExternalSourceKey;
  label: string;
  connected: boolean;
  description: string;
};

/**
 * External intelligence readiness.
 *
 * This module deliberately reports connection state only. It must never
 * fabricate Google, social, market or event data when an integration is not
 * configured. Real providers can be attached here without changing the
 * Consultor IA contract.
 */
export function getExternalIntelligenceStatus(): ExternalSourceStatus[] {
  return [
    {
      key: "google_business",
      label: "Google Business Profile",
      connected: Boolean(process.env["GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN"]),
      description: "Perfil, presença e sinais públicos do negócio no Google.",
    },
    {
      key: "social",
      label: "Redes sociais",
      connected: Boolean(process.env["META_ACCESS_TOKEN"]),
      description: "Presença e conteúdo público conectado via Meta.",
    },
    {
      key: "local_market",
      label: "Mercado e concorrência local",
      connected: Boolean(process.env["GOOGLE_MAPS_API_KEY"]),
      description: "Negócios próximos, categoria e contexto geográfico.",
    },
    {
      key: "events",
      label: "Eventos e acontecimentos locais",
      connected: Boolean(process.env["EVENTBRITE_API_TOKEN"]),
      description: "Eventos relevantes para a região do estabelecimento.",
    },
  ];
}

export function externalIntelligenceSummary() {
  const sources = getExternalIntelligenceStatus();
  return {
    available: sources.some((source) => source.connected),
    sources,
  };
}
