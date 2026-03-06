const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const views = [
  'rosca-helicoidal.ejs',
  'furacao-flange.ejs',
  'cilindro.ejs',
  'curva-gomos.ejs',
  'quadrado-para-redondo.ejs',
  'reducao-concentrica.ejs',
  'semi-cilindro.ejs',
  'boca-de-lobo-excentrica.ejs',
  'boca-de-lobo-45-graus.ejs',
  'boca-de-lobo-90-graus.ejs',
  'mao-francesa.ejs',
];

test('tracagem calculator views include shared _calc_base partial with local path', () => {
  const root = path.join(__dirname, '..', 'views', 'tracagem');
  for (const file of views) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(content, /include\('_calc_base'/, `view ${file} should include _calc_base`);
    assert.doesNotMatch(content, /include\('tracagem\/_calc_base'/, `view ${file} should not include tracagem/_calc_base`);
  }
});
