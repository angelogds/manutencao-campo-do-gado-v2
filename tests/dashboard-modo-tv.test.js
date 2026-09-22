const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboardPath = path.join(__dirname, '..', 'views', 'dashboard', 'index.ejs');
const dashboard = fs.readFileSync(dashboardPath, 'utf8');

test('Modo TV usa os vídeos do mascote como intersticiais', () => {
  assert.match(dashboard, /id="btn-modo-tv"/);
  assert.match(dashboard, /id="modo-tv-stage"/);
  assert.match(dashboard, /\/media\/mascote\/mascote-tv-01\.mp4/);
  assert.match(dashboard, /\/media\/mascote\/mascote-tv-02\.mp4/);
});

test('sequência inicial do Modo TV preserva duas telas operacionais', () => {
  const video1 = dashboard.indexOf("src:'/media/mascote/mascote-tv-01.mp4'");
  const screen1 = dashboard.indexOf("column:0");
  const screen2 = dashboard.indexOf("column:1");
  const video2 = dashboard.indexOf("src:'/media/mascote/mascote-tv-02.mp4'");

  assert.ok(video1 >= 0, 'vídeo 1 deve existir na sequência');
  assert.ok(screen1 > video1, 'tela 1 deve vir depois do vídeo 1');
  assert.ok(screen2 > screen1, 'tela 2 deve vir depois da tela 1');
  assert.ok(video2 > screen2, 'vídeo 2 deve vir depois da tela 2');
});

test('Modo TV não mantém o mascote pequeno preso ao cabeçalho', () => {
  assert.doesNotMatch(dashboard, /id="tv-mascot-video"/);
  assert.doesNotMatch(dashboard, /class="tv-mascot-shell"/);
});

test('alerta emergencial continua tendo prioridade sobre o Modo TV', () => {
  assert.match(dashboard, /body\.tv-alerta-ativo \.modo-tv-stage\.is-active \{ display:none; \}/);
});
