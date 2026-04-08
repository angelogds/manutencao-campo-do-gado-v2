const test = require('node:test');
const assert = require('node:assert/strict');

const { extractFirstJsonObject, safeParseAiJson } = require('../modules/os/os-ai-json.util');

test('extractFirstJsonObject captures nested JSON payload', () => {
  const text = 'Resposta: {"criticidade":"ALTA","meta":{"setor":"Graxaria"}} fim';
  const json = extractFirstJsonObject(text);

  assert.equal(json, '{"criticidade":"ALTA","meta":{"setor":"Graxaria"}}');
});

test('safeParseAiJson supports markdown fenced json', () => {
  const text = '```json\n{"criticidade":"MEDIA","tempo_estimado_minutos":30}\n```';
  const parsed = safeParseAiJson(text);

  assert.equal(parsed.criticidade, 'MEDIA');
  assert.equal(parsed.tempo_estimado_minutos, 30);
});

test('safeParseAiJson returns empty object when payload is invalid', () => {
  const parsed = safeParseAiJson('sem json aqui');
  assert.deepEqual(parsed, {});
});
