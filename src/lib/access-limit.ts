/** Server-owned policies; never accept limits, bucket keys or IPs from payloads. */
export const ACCESS_LIMITS = {
  otp: { seconds: 300, identity: 5, tenant: 60, global: 1000, ip: 20 },
  booking: { seconds: 600, identity: 5, tenant: 60, global: 1000, ip: 20 },
  pin: { seconds: 300, identity: 5, tenant: 100, global: 2000, ip: 30 },
  ai: { seconds: 3600, identity: 30, tenant: 30, global: 3000, ip: 60 },
} as const;
export type AccessAction = keyof typeof ACCESS_LIMITS;

/** No header is trusted by default: reverse proxies must strip spoofed values.
 * Enable only after verifying that the hosting edge overwrites this header.
 * X-Forwarded-For, Forwarded and request-body IPs are deliberately never used.
 */
export function trustedEdgeIp(headers: Headers, verifiedHeader?: string): string | null {
  if (verifiedHeader !== "cf-connecting-ip") return null;
  const value = headers.get(verifiedHeader)?.trim();
  if (!value || value.includes(",") || value.length > 45) return null;
  const ipv4 = value.split(".");
  if (ipv4.length === 4 && ipv4.every((v) => /^\d{1,3}$/.test(v) && Number(v) <= 255)) return value;
  if (/^[0-9a-f:]+$/i.test(value) && value.includes(":")) return value.toLowerCase();
  return null;
}