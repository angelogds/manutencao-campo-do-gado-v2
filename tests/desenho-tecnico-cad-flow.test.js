const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const routesContent = fs.readFileSync(require.resolve('../modules/desenho-tecnico/desenho-tecnico.routes'), 'utf8');
const controllerContent = fs.readFileSync(require.resolve('../modules/desenho-tecnico/desenho-tecnico.controller'), 'utf8');
const serviceContent = fs.readFileSync(require.resolve('../modules/desenho-tecnico/desenho-tecnico.service'), 'utf8');

test('cad routes expose metadata endpoint', () => {
  assert.equal(routesContent.includes("router.post('/cad/:id/metadata'"), true);
});

test('controller includes CAD metadata update handler', () => {
  assert.equal(controllerContent.includes('function updateCadMetadata'), true);
});

test('service exports CAD minimal flow helpers', () => {
  assert.equal(serviceContent.includes('function validateCadMetadata'), true);
  assert.equal(serviceContent.includes('function buildDefaultCadData'), true);
});
