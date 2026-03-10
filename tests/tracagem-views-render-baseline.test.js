const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const customViews = [
  ['furacao-flange.ejs', 'partials/svg/flange-svg'],
  ['cilindro.ejs', 'partials/svg/cilindro-svg'],
  ['mao-francesa.ejs', 'partials/svg/mao-francesa-svg'],
  ['curva-gomos.ejs', 'partials/svg/curva-gomos-svg'],
  ['quadrado-para-redondo.ejs', 'partials/svg/retangulo-redondo-svg'],
];

const legacyViews = [
  'reducao-concentrica.ejs',
  'semi-cilindro.ejs',
  'boca-de-lobo-excentrica.ejs',
  'boca-de-lobo-45-graus.ejs',
  'boca-de-lobo-90-graus.ejs',
];

test('tracagem custom views include SVG partials and post calculate route', () => {
  const root = path.join(__dirname, '..', 'views', 'tracagem');
  for (const [file, partial] of customViews) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(content, /layout\('layout'\)/, `view ${file} should use layout`);
    assert.match(content, /method="POST"/, `view ${file} should have POST form`);
    assert.match(content, new RegExp(partial), `view ${file} should include svg partial`);
    assert.match(content, /Planificação/, `view ${file} should have Planificação section`);
    assert.match(content, /CALCULAR/, `view ${file} should have CALCULAR button`);
  }
});

test('rosca helicoidal usa imagens técnicas estáticas e cálculo via formulário', () => {
  const viewPath = path.join(__dirname, '..', 'views', 'tracagem', 'rosca-helicoidal.ejs');
  const content = fs.readFileSync(viewPath, 'utf8');

  assert.match(content, /layout\('layout'\)/, 'rosca-helicoidal should use layout');
  assert.match(content, /method="POST"/, 'rosca-helicoidal should have POST form');
  assert.match(content, /\/img\/tracagem\/planificacoes\/rosca-helicoidal-peca\.png/, 'rosca-helicoidal should show peça image');
  assert.match(content, /\/img\/tracagem\/planificacoes\/rosca-helicoidal-planificacao\.png/, 'rosca-helicoidal should show planificação image');
  assert.doesNotMatch(content, /partials\/svg\/rosca-svg/, 'rosca-helicoidal should not include svg partial');
  assert.match(content, /R1\s*=\s*<%=\s*resultado\.R1/, 'rosca-helicoidal should show R1');
  assert.match(content, /R2\s*=\s*<%=\s*resultado\.R2/, 'rosca-helicoidal should show R2');
  assert.match(content, /C\s*=\s*<%=\s*resultado\.C/, 'rosca-helicoidal should show C');
  assert.match(content, /T\s*=\s*<%=\s*resultado\.T/, 'rosca-helicoidal should show T');
});

test('legacy tracagem views continue using _calc_base partial', () => {
  const root = path.join(__dirname, '..', 'views', 'tracagem');
  for (const file of legacyViews) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(content, /include\('_calc_base'/, `view ${file} should include _calc_base`);
  }
});

test('svg partials usam viewBox padrão técnico', () => {
  const root = path.join(__dirname, '..', 'views', 'tracagem', 'partials', 'svg');
  const arquivos = [
    'cilindro-svg.ejs',
    'flange-svg.ejs',
    'mao-francesa-svg.ejs',
    'rosca-svg.ejs',
    'curva-gomos-svg.ejs',
    'retangulo-redondo-svg.ejs',
  ];

  for (const file of arquivos) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(content, /viewBox="0 0 800 600"/, `${file} should use default technical viewBox`);
    assert.match(content, /stroke="#222"/, `${file} should use technical stroke color`);
  }
});

test('assets da rosca helicoidal existem no caminho público esperado', () => {
  const root = path.join(__dirname, '..', 'public', 'img', 'tracagem');
  const arquivos = [
    'capas/rosca-helicoidal.png',
    'planificacoes/rosca-helicoidal-peca.png',
    'planificacoes/rosca-helicoidal-planificacao.png',
  ];

  for (const file of arquivos) {
    const fullPath = path.join(root, file);
    assert.equal(fs.existsSync(fullPath), true, `${file} should exist in public/img/tracagem`);
  }
});
