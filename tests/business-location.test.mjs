import test from "node:test";
import assert from "node:assert/strict";
import { googleMapsDirectionsUrl, appendBusinessLocation } from "../src/lib/business-location.ts";

test("Maps link uses Google Maps directions and encodes address safely", () => {
  const url = googleMapsDirectionsUrl("Estrada para o Monjolinho, 0, Itapeva - MG");
  assert.ok(url);
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://www.google.com");
  assert.equal(parsed.pathname, "/maps/dir/");
  assert.equal(parsed.searchParams.get("api"), "1");
  assert.equal(parsed.searchParams.get("destination"), "Estrada para o Monjolinho, 0, Itapeva - MG");
});

test("Missing address does not create a route or fake location", () => {
  for (const address of ["", " ", null, undefined, "0", "---"]) {
    assert.equal(googleMapsDirectionsUrl(address), null);
    assert.equal(appendBusinessLocation("Confirmado.", "Empresa", address), "Confirmado.");
  }
});

test("WhatsApp confirmation and reminder can append the same destination", () => {
  const original = "Agendamento confirmado!";
  const text = appendBusinessLocation(original, "Lava Teste", "Rua das Flores, 123, Extrema MG");
  assert.match(text, /Lava Teste/);
  assert.match(text, /Rua das Flores/);
  assert.match(text, /https:\/\/www\.google\.com\/maps\/dir\//);
  assert.equal(text.startsWith(original), true);
});

test("User-supplied address cannot replace Google Maps origin", () => {
  const url = googleMapsDirectionsUrl("Rua 1 &next=https://malicious.example");
  assert.ok(url);
  assert.equal(new URL(url).origin, "https://www.google.com");
  assert.equal(new URL(url).searchParams.get("destination"), "Rua 1 &next=https://malicious.example");
});
