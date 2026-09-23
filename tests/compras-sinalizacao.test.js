const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Compras rastreia visualização por usuário sem alterar status da solicitação', () => {
  const service = read('modules/compras/compras.service.js');
  assert.match(service, /compras_solicitacao_visualizacoes/);
  assert.match(service, /UNIQUE \(solicitacao_id, user_id\)/);
  assert.match(service, /function marcarVisualizada/);
  assert.doesNotMatch(service, /marcarVisualizada[\s\S]{0,500}UPDATE solicitacoes SET status/);
});

test('Abrir detalhe marca somente a visualização do operador', () => {
  const controller = read('modules/compras/compras.controller.js');
  assert.match(controller, /service\.marcarVisualizada\(id, userId\)/);
  assert.match(controller, /getNaoVisualizadasCount\(userId\)/);
});

test('Painel e menu exibem sinalização de novas solicitações', () => {
  const view = read('views/compras/solicitacoes/index.ejs');
  const sidebar = read('views/partials/sidebar.ejs');
  assert.match(view, /Novas solicitações aguardando visualização/);
  assert.match(view, /compras-new-badge/);
  assert.match(sidebar, /comprasNaoVisualizadas/);
});


test('Modo não visualizadas permanece ativo em filtros e exportação', () => {
  const view = read('views/compras/solicitacoes/index.ejs');
  assert.match(view, /name="novas" value="1"/);
  assert.match(view, /filters\?\.unreadOnly \? 'novas=1&'/);
});

test('Solicitações concluídas não recebem selo NOVA e contador atualiza no detalhe', () => {
  const service = read('modules/compras/compras.service.js');
  const controller = read('modules/compras/compras.controller.js');
  assert.match(service, /s\.status NOT IN \('FECHADA','RECEBIDA_TOTAL'\)/);
  assert.match(controller, /res\.locals\.comprasNaoVisualizadas = service\.getNaoVisualizadasCount\(userId\)/);
});
