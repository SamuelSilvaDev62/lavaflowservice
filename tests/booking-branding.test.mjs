import test from "node:test";
import assert from "node:assert/strict";
import { safeBookingBranding, accessibleForeground, DEFAULT_BOOKING_BRANDING, isHexColor } from "../src/lib/booking-branding.ts";

test("existing establishments retain default booking look", () => {
  assert.deepEqual(safeBookingBranding(null), DEFAULT_BOOKING_BRANDING);
});

test("branding is normalized without affecting other businesses", () => {
  const a = safeBookingBranding({ primary_color: "#bb1133", secondary_color: "#111111", cover_url: "https://example.com/cover.webp", logo_url: null, tagline: "Agende hoje" });
  const b = safeBookingBranding(null);
  assert.equal(a.primary_color, "#bb1133");
  assert.equal(b.primary_color, DEFAULT_BOOKING_BRANDING.primary_color);
});

test("disallow dangerous image protocols and invalid colors", () => {
  const b = safeBookingBranding({ primary_color: "red", secondary_color: "url(evil)", cover_url: "javascript:alert(1)", logo_url: "data:image/svg+xml,<svg/>", tagline: null });
  assert.equal(b.cover_url, null);
  assert.equal(b.logo_url, null);
  assert.equal(b.primary_color, DEFAULT_BOOKING_BRANDING.primary_color);
  assert.equal(b.secondary_color, DEFAULT_BOOKING_BRANDING.secondary_color);
});

test("text foreground maintains contrast for dark and light brands", () => {
  assert.equal(accessibleForeground("#000000"), "#FFFFFF");
  assert.equal(accessibleForeground("#FFFFFF"), "#111827");
  assert.equal(isHexColor("#abcdef"), true);
  assert.equal(isHexColor("#abc"), false);
});
