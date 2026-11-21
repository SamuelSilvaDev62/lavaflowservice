import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBookingPhone, bookingPhoneLookupSuffix, isSameBookingPhone } from "../src/lib/booking-customer-phone.ts";

test("booking phone matches formatted and unformatted Brazilian numbers", () => {
  assert.equal(normalizeBookingPhone("+55 (35) 99999-1234"), "35999991234");
  assert.equal(normalizeBookingPhone("(35) 99999-1234"), "35999991234");
  assert.equal(normalizeBookingPhone("35999991234"), "35999991234");
  assert.equal(isSameBookingPhone("+55 35 99999-1234", "35999991234"), true);
  assert.equal(isSameBookingPhone("35 3222-1234", "3532221234"), true);
});
test("does not merge different customer phones based on only last four digits", () => {
  assert.equal(isSameBookingPhone("35999991234", "31988881234"), false);
  assert.equal(bookingPhoneLookupSuffix("(35) 99999-1234"), "1234");
});
test("never match empty or invalid phone strings", () => {
  assert.equal(isSameBookingPhone("", ""), false);
  assert.equal(isSameBookingPhone("abc", ""), false);
  assert.equal(bookingPhoneLookupSuffix("12"), "");
});
test("keeps non-Brazilian international numbers unchanged", () => {
  assert.equal(normalizeBookingPhone("+1 (212) 555-0123"), "12125550123");
});
