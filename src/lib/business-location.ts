/**
 * Public directions URL for the address registered by the establishment.
 * Uses Maps URLs (no API key, embed, or assumed coordinates).
 * No link is exposed when the address is blank or incomplete.
 */
export function googleMapsDirectionsUrl(address?: string | null): string | null {
  const value = address?.trim();
  if (!value || value.length < 8 || /^[-,\s0-9]+$/.test(value)) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", value);
  return url.toString();
}

export function appendBusinessLocation(
  message: string,
  businessName?: string | null,
  address?: string | null,
): string {
  const url = googleMapsDirectionsUrl(address);
  if (!url) return message;
  return `${message}\n\n📍 ${businessName?.trim() || "Local do atendimento"}\n${address?.trim()}\n🗺️ Como chegar: ${url}`;
}
