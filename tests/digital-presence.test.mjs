import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingChannel, googleBookingUrl, googleMetrics, isGoogleReference, presenceChecklist, reviewInvitation } from '../src/lib/digital-presence.ts';

test('link público de agendamento identifica origem Google', () => {
  assert.equal(googleBookingUrl('lava-teste'), 'https://lavaflowservice.lovable.app/agendar/lava-teste?utm_source=google&utm_medium=organic&utm_campaign=perfil_empresa');
  assert.equal(bookingChannel('google'), 'google');
  assert.equal(bookingChannel('facebook'), 'publico');
});
test('somente links HTTPS do Google são aceitos', () => {
  assert.equal(isGoogleReference('https://g.page/r/teste/review'), true);
  assert.equal(isGoogleReference('https://google.com.evil.example'), false);
  assert.equal(isGoogleReference('http://google.com/maps'), false);
});
test('etapas confirmadas pelo usuário ficam separadas do cadastro interno', () => {
  const result = presenceChecklist({ empresa: { nome_fantasia: 'Teste' }, context: {}, services: 0, confirmations: { verified: { at: '2026-01-01', by: 'u' } } });
  assert.equal(result.steps.find((s) => s.key === 'verified')?.provenance, 'user');
  assert.equal(result.steps.find((s) => s.key === 'name')?.provenance, 'internal');
  assert.equal(result.progress, 20);
});
test('receita Google conta apenas OS entregues vinculadas a reservas Google', () => {
  const m = googleMetrics([
    { origem: 'google', status: 'concluido', ordem_id: 'a' },
    { origem: 'google', status: 'cancelado', ordem_id: null },
    { origem: 'publico', status: 'concluido', ordem_id: 'b' },
  ], [{ id: 'a', status: 'entregue', valor: 80 }, { id: 'b', status: 'entregue', valor: 200 }]);
  assert.deepEqual(m, { bookings: 2, canceled: 1, delivered: 1, orderValue: 80 });
});
test('convite de avaliação não oferece incentivo nem pede nota positiva', () => {
  const text = reviewInvitation('Lava Teste', 'https://g.page/r/x/review');
  assert.match(text, /Não oferecemos benefícios/);
  assert.doesNotMatch(text, /5 estrelas|desconto/i);
});
