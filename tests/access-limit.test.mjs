import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESS_LIMITS, trustedEdgeIp } from '../src/lib/access-limit.ts';

test('OTP admite no máximo 5 tentativas por identidade em 5 minutos', () => {
  assert.equal(ACCESS_LIMITS.otp.identity, 5);
  assert.equal(ACCESS_LIMITS.otp.seconds, 300);
});
test('PIN admite no máximo 5 tentativas por identidade em 5 minutos', () => {
  assert.equal(ACCESS_LIMITS.pin.identity, 5);
  assert.equal(ACCESS_LIMITS.pin.seconds, 300);
});
test('agendamento público admite 5 solicitações por identidade em 10 minutos', () => {
  assert.equal(ACCESS_LIMITS.booking.identity, 5);
  assert.equal(ACCESS_LIMITS.booking.seconds, 600);
});
test('assistente preserva 30 perguntas por estabelecimento por hora', () => {
  assert.equal(ACCESS_LIMITS.ai.tenant, 30);
  assert.equal(ACCESS_LIMITS.ai.seconds, 3600);
});
test('headers enviados por visitantes não são IP confiável por padrão', () => {
  const headers = new Headers({ 'cf-connecting-ip': '203.0.113.1', 'x-forwarded-for': '203.0.113.2', forwarded: 'for=203.0.113.3' });
  assert.equal(trustedEdgeIp(headers), null);
  assert.equal(trustedEdgeIp(headers, 'x-forwarded-for'), null);
  assert.equal(trustedEdgeIp(headers, 'cf-connecting-ip'), '203.0.113.1');
});
test('cadeias de proxies e valores inválidos são rejeitados mesmo com header verificado', () => {
  for (const value of ['203.0.113.1, 203.0.113.2', '999.1.1.1', 'not-an-ip', '']) {
    assert.equal(trustedEdgeIp(new Headers({ 'cf-connecting-ip': value }), 'cf-connecting-ip'), null);
  }
});