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

test('calcFuracaoFlange uses N and returns furos list + corda', () => {
  const out = service.calcFuracaoFlange({ D: 200, N: 4 });
  assert.deepEqual(out.entrada, { D: 200, N: 4 });
  assert.equal(out.resultado.raio, 100);
  assert.equal(out.resultado.anguloEntreFuros, 90);
  assert.equal(out.resultado.corda, 141.42);
  assert.equal(out.resultado.furos.length, 4);
  assert.equal(out.resultado.furos[1].angulo, 90);
});

test('calcCilindro returns A and B', () => {
  const out = service.calcCilindro({ D: 100, h: 50, E: 3 });
  assert.deepEqual(out.entrada, { D: 100, h: 50, E: 3 });
  assert.equal(out.resultado.A, 314.16);
  assert.equal(out.resultado.B, 50);
});

test('calcMaoFrancesa computes diagonal/alpha from A and h', () => {
  const out = service.calcMaoFrancesa({ A: 300, h: 400, E: 10 });
  assert.deepEqual(out.entrada, { A: 300, h: 400, E: 10 });
  assert.equal(out.resultado.C, 500);
  assert.equal(out.resultado.alpha, 53.13);
  assert.equal(out.resultado.B, 10);
  assert.equal(out.resultado.D, 10);
});
