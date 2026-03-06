const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const customViews = [
  ['rosca-helicoidal.ejs', "partials/svg/rosca-svg"],
  ['furacao-flange.ejs', "partials/svg/flange-svg"],
  ['cilindro.ejs', "partials/svg/cilindro-svg"],
  ['mao-francesa.ejs', "partials/svg/mao-francesa-svg"],
];

const legacyViews = [
  'curva-gomos.ejs',
  'quadrado-para-redondo.ejs',
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
    assert.match(content, /CALCULAR/, `view ${file} should have CALCULAR button`);
  }
});

test('legacy tracagem views continue using _calc_base partial', () => {
  const root = path.join(__dirname, '..', 'views', 'tracagem');
  for (const file of legacyViews) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(content, /include\('_calc_base'/, `view ${file} should include _calc_base`);
  }
});
