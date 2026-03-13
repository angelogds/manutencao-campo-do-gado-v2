const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const routesContent = fs.readFileSync(require.resolve('../modules/desenho-tecnico/desenho-tecnico.routes'), 'utf8');
const controllerContent = fs.readFileSync(require.resolve('../modules/desenho-tecnico/desenho-tecnico.controller'), 'utf8');
const serviceContent = fs.readFileSync(require.resolve('../modules/desenho-tecnico/desenho-tecnico.service'), 'utf8');

test('cad routes expose metadata endpoint', () => {
  assert.equal(routesContent.includes("router.post('/cad/:id/metadata'"), true);
});

test('cad/novo route is declared before generic /:id route', () => {
  const cadNovoPos = routesContent.indexOf("router.get('/cad/novo'");
  const genericPos = routesContent.indexOf("router.get('/:id'");
  assert.notEqual(cadNovoPos, -1);
  assert.notEqual(genericPos, -1);
  assert.equal(cadNovoPos < genericPos, true);
});

test('controller includes CAD metadata update handler', () => {
  assert.equal(controllerContent.includes('function updateCadMetadata'), true);
});

test('controller includes CAD diagnostic logs', () => {
  assert.equal(controllerContent.includes('function logCad('), true);
  assert.equal(controllerContent.includes('function logCadError('), true);
});

test('service exports CAD minimal flow helpers', () => {
  assert.equal(serviceContent.includes('function validateCadMetadata'), true);
  assert.equal(serviceContent.includes('function buildDefaultCadData'), true);
});
