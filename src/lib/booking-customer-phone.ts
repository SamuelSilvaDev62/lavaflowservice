/** Brazilian WhatsApp normalization for comparing public booking contacts.
 * Keep non-Brazilian country codes intact; strip +55 only for valid DDD+number lengths.
 */
export function normalizeBookingPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

export function bookingPhoneLookupSuffix(raw: string): string {
  const phone = normalizeBookingPhone(raw);
  return phone.length >= 8 ? phone.slice(-4) : "";
}

export function isSameBookingPhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const phoneA = normalizeBookingPhone(a);
  const phoneB = normalizeBookingPhone(b);
  return phoneA.length >= 8 && phoneA === phoneB;
}
