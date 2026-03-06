const test = require('node:test');
const assert = require('node:assert/strict');

const service = require('../modules/tracagem/tracagem.service');

test('calcRoscaHelicoidal returns padrão entrada/resultado/observacoes', () => {
  const out = service.calcRoscaHelicoidal({ D: 100, d: 60, P: 20 });
  assert.deepEqual(out.entrada, { D: 100, d: 60, P: 20 });
  assert.equal(out.resultado.R1, 50);
  assert.equal(out.resultado.R2, 30);
  assert.equal(out.resultado.C, 125.66);
  assert.equal(out.resultado.T, 252.12);
  assert.ok(Array.isArray(out.observacoes));
});

test('calcFuracaoFlange uses N and returns furos list', () => {
  const out = service.calcFuracaoFlange({ D: 200, N: 4 });
  assert.deepEqual(out.entrada, { D: 200, N: 4 });
  assert.equal(out.resultado.raio, 100);
  assert.equal(out.resultado.anguloEntreFuros, 90);
  assert.equal(out.resultado.furos.length, 4);
  assert.equal(out.resultado.furos[1].angulo, 90);
});

test('calcCilindro returns comprimento e area', () => {
  const out = service.calcCilindro({ D: 100, h: 50, E: 3 });
  assert.deepEqual(out.entrada, { D: 100, h: 50, E: 3 });
  assert.equal(out.resultado.comprimento, 314.16);
  assert.equal(out.resultado.area, 15707.96);
});

test('calcMaoFrancesa computes diagonal from base and altura', () => {
  const out = service.calcMaoFrancesa({ base: 300, altura: 400 });
  assert.deepEqual(out.entrada, { base: 300, altura: 400 });
  assert.equal(out.resultado.diagonal, 500);
});
