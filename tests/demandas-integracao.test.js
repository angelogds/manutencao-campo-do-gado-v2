const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

test('Demandas expõe rotas de subdemandas, materiais e conversão para OS', () => {
  const routes = read('modules/demandas/demandas.routes.js');
  assert.match(routes, /\/:id\/subdemandas/);
  assert.match(routes, /\/:id\/materiais/);
  assert.match(routes, /\/:id\/convert-to-os/);
  assert.match(routes, /ACCESS\.demandas_materials/);
});

test('Conversão da demanda preserva solicitação e vincula a OS sem duplicar materiais', () => {
  const service = read('modules/demandas/demandas.service.js');
  assert.match(service, /SELECT id FROM os WHERE demanda_id=/);
  assert.match(service, /UPDATE solicitacoes SET os_id=/);
  assert.match(service, /tipo_origem='DEMANDA_OS'/);
});

test('Planejamento de materiais usa a solicitação existente com origem DEMANDA', () => {
  const demandas = read('modules/demandas/demandas.service.js');
  const solicitacoes = read('modules/solicitacoes/solicitacoes.service.js');
  assert.match(demandas, /tipo_origem: 'DEMANDA'/);
  assert.match(solicitacoes, /SOL_HAS_TIPO_ORIGEM/);
  assert.match(solicitacoes, /String\(tipo_origem/);
});

test('Migration é aditiva e cria vínculos de hierarquia e OS', () => {
  const migration = read('database/migrations/238_demandas_planejamento_integrado.sql');
  assert.match(migration, /ALTER TABLE demandas ADD COLUMN demanda_pai_id/);
  assert.match(migration, /ALTER TABLE demandas ADD COLUMN equipamento_id/);
  assert.match(migration, /ALTER TABLE os ADD COLUMN demanda_id/);
  assert.doesNotMatch(migration, /DROP TABLE demandas/i);
  assert.doesNotMatch(migration, /DELETE FROM demandas/i);
});
