const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const viewsComImagemFixa = [
  ['furacao-flange.ejs', '/img/tracagem/planificacoes/furacao-flange-peca.png', '/img/tracagem/planificacoes/furacao-flange-planificacao.png'],
  ['cilindro.ejs', '/img/tracagem/planificacoes/cilindro-peca.png', '/img/tracagem/planificacoes/cilindro-planificacao.png'],
  ['curva-gomos.ejs', '/img/tracagem/planificacoes/curva-gomos-peca.png', '/img/tracagem/planificacoes/curva-gomos-planificacao.png'],
  ['quadrado-redondo.ejs', '/img/tracagem/planificacoes/quadrado-para-redondo-peca.png', '/img/tracagem/planificacoes/quadrado-para-redondo-planificacao.png'],
  ['reducao-concentrica.ejs', '/img/tracagem/planificacoes/reducao-concentrica-peca.png', '/img/tracagem/planificacoes/reducao-concentrica-planificacao.png'],
  ['semi-cilindro.ejs', '/img/tracagem/planificacoes/semicilindro-peca.png.JPG', '/img/tracagem/planificacoes/semicilindro-planificacao.png.JPG'],
  ['boca-lobo-excentrica.ejs', '/img/tracagem/planificacoes/boca-de-lobo-excentrica-peca.png', '/img/tracagem/planificacoes/boca-de-lobo-excentrica-planificacao.png'],
  ['boca-lobo-45.ejs', '/img/tracagem/planificacoes/boca-de-lobo-45-peca.png', '/img/tracagem/planificacoes/boca-de-lobo-45-planificacao.png'],
  ['boca-lobo-90.ejs', '/img/tracagem/planificacoes/boca-de-lobo-90-peca.png', '/img/tracagem/planificacoes/boca-de-lobo-90-planificacao.png'],
  ['mao-francesa.ejs', '/img/tracagem/planificacoes/mao-francesa-peca.png', '/img/tracagem/planificacoes/mao-francesa-planificacao.png'],
];

test('views de tracagem usam formulário POST e imagens técnicas fixas', () => {
  const root = path.join(__dirname, '..', 'views', 'tracagem');
  for (const [file, pecaImg, planImg] of viewsComImagemFixa) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(content, /layout\('layout'\)/, `view ${file} should use layout`);
    assert.match(content, /method="POST"/, `view ${file} should have POST form`);
    assert.match(content, new RegExp(pecaImg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `view ${file} should include peça image`);
    assert.match(content, new RegExp(planImg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `view ${file} should include planificação image`);
    assert.match(content, /Planificação/, `view ${file} should have Planificação section`);
    assert.match(content, /CALCULAR/, `view ${file} should have CALCULAR button`);
    assert.doesNotMatch(content, /partials\/svg\//, `view ${file} should not include svg partial`);
    assert.doesNotMatch(content, /_calc_base/, `view ${file} should not include _calc_base`);
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
});

test('assets de tracagem existem no caminho público esperado', () => {
  const root = path.join(__dirname, '..', 'public', 'img', 'tracagem');
  const arquivos = [
    'capas/furacao-flange.png',
    'capas/cilindro.png',
    'capas/curva-gomos.png',
    'capas/quadrado-para-redondo.png',
    'capas/reducao-concentrica.png',
    'planificacoes/rosca-helicoidal-peca.png',
    'planificacoes/rosca-helicoidal-planificacao.png',
  ];

  for (const file of arquivos) {
    const fullPath = path.join(root, file);
    assert.equal(fs.existsSync(fullPath), true, `${file} should exist in public/img/tracagem`);
  }
});
