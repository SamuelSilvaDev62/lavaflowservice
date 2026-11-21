export const DEFAULT_BOOKING_BRANDING = {
  primary_color: "#2563EB",
  secondary_color: "#F8FAFC",
  cover_url: null as string | null,
  logo_url: null as string | null,
  tagline: null as string | null,
};

export type BookingBranding = typeof DEFAULT_BOOKING_BRANDING;

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function colorLuminance(hex: string): number {
  const channels = [1, 3, 5].map(index => {
    const n = parseInt(hex.slice(index, index + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
export function accessibleForeground(hex: string): string {
  // White versus almost-black, choosing the higher WCAG contrast.
  if (!isHexColor(hex)) return "#FFFFFF";
  const lum = colorLuminance(hex);
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? "#111827" : "#FFFFFF";
}

export function safeBookingBranding(value: Partial<BookingBranding> | null | undefined): BookingBranding {
  const url = (v: unknown): string | null => {
    if (typeof v !== "string" || v.length > 1000) return null;
    try {
      const parsed = new URL(v);
      return parsed.protocol === "https:" ? parsed.href : null;
    } catch { return null; }
  };
  return {
    primary_color: isHexColor(value?.primary_color ?? "") ? value!.primary_color! : DEFAULT_BOOKING_BRANDING.primary_color,
    secondary_color: isHexColor(value?.secondary_color ?? "") ? value!.secondary_color! : DEFAULT_BOOKING_BRANDING.secondary_color,
    cover_url: url(value?.cover_url),
    logo_url: url(value?.logo_url),
    tagline: typeof value?.tagline === "string" ? value.tagline.slice(0, 120) : null,
  };
}
