import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_BUSINESS_ADDRESS, formatCep, formatBusinessAddress,
  parseBusinessAddress, applyCepLookup, validAddress
} from "../src/lib/business-address.ts";

test("formats Brazilian CEP and rejects partial CEP", () => {
  assert.equal(formatCep(" 37655-000 "), "37655-000");
  assert.equal(formatCep("123"), "123");
  assert.equal(formatCep("376550001"), "37655-000");
});
test("complete address round-trips including CEP and complemento", () => {
  const a = {cep:"37655-000", rua:"Rua das Flores", numero:"160-B", complemento:"Casa 2", bairro:"Vale Verde", cidade:"Itapeva", uf:"MG"};
  assert.equal(validAddress(a),true);
  assert.deepEqual(parseBusinessAddress(formatBusinessAddress(a)),a);
});
test("rural address works with S/N and no CEP", () => {
  const a={cep:"", rua:"Estrada Monjolinho", numero:"S/N", complemento:"", bairro:"Zona Rural", cidade:"Itapeva", uf:"MG"};
  assert.equal(validAddress(a),true);
  assert.deepEqual(parseBusinessAddress(formatBusinessAddress(a)),a);
});
test("legacy unstructured address is never silently parsed", () => {
  assert.equal(parseBusinessAddress("Estrada para o Monjolinho, 0"),null);
});
test("ViaCEP lookup fills known fields without erasing number and manual values", () => {
  const before={...EMPTY_BUSINESS_ADDRESS, cep:"37655-000",numero:"160-B", complemento:"Perto do campo",bairro:"Vale Verde"};
  const after=applyCepLookup(before,{cep:"37655-000",logradouro:"Rua Um",bairro:"",localidade:"Itapeva",uf:"MG"});
  assert.equal(after.numero,"160-B");
  assert.equal(after.complemento,"Perto do campo");
  assert.equal(after.bairro,"Vale Verde");
  assert.equal(after.cidade,"Itapeva");
  assert.deepEqual(applyCepLookup(after,{erro:true}),after);
});
test("invalid partial structured address cannot be saved", () => {
  assert.equal(validAddress({...EMPTY_BUSINESS_ADDRESS,cep:"123",rua:"Rua X"}), false);
});
