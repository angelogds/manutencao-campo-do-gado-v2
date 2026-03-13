function generateDrawingFrame(w = 900, h = 560) {
  return `<rect x="20" y="20" width="${w - 40}" height="${h - 40}" fill="#fff" stroke="#1f2937" stroke-width="2" />`;
}

function generateGrid(w = 900, h = 560, step = 25) {
  const lines = [];
  for (let x = 20; x <= w - 20; x += step) lines.push(`<line x1="${x}" y1="20" x2="${x}" y2="${h - 20}" stroke="#eef2f7"/>`);
  for (let y = 20; y <= h - 20; y += step) lines.push(`<line x1="20" y1="${y}" x2="${w - 20}" y2="${y}" stroke="#eef2f7"/>`);
  return lines.join('');
}

function generateTitleBlock(meta, w = 900, h = 560) {
  return `<rect x="${w - 300}" y="${h - 120}" width="260" height="80" fill="#f8fafc" stroke="#334155"/>
  <text x="${w - 290}" y="${h - 95}" font-size="12" fill="#0f172a">${meta.codigo || '-'} | Rev ${meta.revisao || 0}</text>
  <text x="${w - 290}" y="${h - 75}" font-size="12" fill="#0f172a">${meta.titulo || '-'}</text>
  <text x="${w - 290}" y="${h - 55}" font-size="11" fill="#334155">${meta.categoria || ''} / ${meta.subtipo || ''}</text>`;
}

function generateLinearDimension(x1, y1, x2, y2, text) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#166534" stroke-dasharray="4 3"/>
  <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-size="12" fill="#14532d">${text}</text>`;
}

function generateCenterLine(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0284c7" stroke-dasharray="6 4"/>`;
}

function generateTextLabel(x, y, text) {
  return `<text x="${x}" y="${y}" font-size="12" fill="#0f172a">${text}</text>`;
}

function generateCircle(cx, cy, r) { return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0f172a" stroke-width="2" />`; }
function generateRect(x, y, w, h) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#0f172a" stroke-width="2" />`; }

function generateSteppedShaft(params = {}) {
  const a = params.assento1 || 60;
  const b = params.assento2 || 45;
  const c = params.encosto || 80;
  return `<path d="M140 220 h${a} v-30 h${b} v30 h${c} v50 h-${c} v30 h-${b} v-30 h-${a} z" fill="none" stroke="#111827" stroke-width="2"/>`;
}

function generateFlange(params = {}) {
  const de = Math.max(50, params.diametroExterno || 180);
  const di = Math.max(20, params.diametroInterno || 90);
  const cx = 290; const cy = 240;
  return `${generateCircle(cx, cy, de / 2)}${generateCircle(cx, cy, di / 2)}${generateCenterLine(cx - de / 2 - 20, cy, cx + de / 2 + 20, cy)}${generateCenterLine(cx, cy - de / 2 - 20, cx, cy + de / 2 + 20)}`;
}

function generatePlate(params = {}) {
  return generateRect(160, 180, params.largura || 230, params.altura || 130);
}

function generateBracket(params = {}) {
  const b = params.base || 220;
  const h = params.altura || 140;
  return `<polygon points="180,300 ${180 + b},300 180,${300 - h}" fill="none" stroke="#0f172a" stroke-width="2"/>`;
}

function generateTransitionShape(params = {}) {
  const q = params.ladoQuadrado || 160;
  const d = params.diametro || 120;
  return `<rect x="150" y="130" width="${q}" height="${q}" fill="none" stroke="#0f172a" stroke-width="2"/>
  <path d="M150 ${130 + q} C 210 340, 260 340, 320 ${130 + q}" fill="none" stroke="#0f172a" stroke-width="2"/>
  ${generateCircle(235, 360, d / 2)}`;
}

function renderTechnicalDrawing(data = {}) {
  const params = data.params || {};
  const subtipo = String(data.subtipo || '').toUpperCase();
  let shape = generatePlate(params);
  if (subtipo.includes('EIXO')) shape = generateSteppedShaft(params);
  if (subtipo.includes('FLANGE')) shape = generateFlange(params);
  if (subtipo.includes('MAO_FRANCESA') || subtipo.includes('SUPORTE')) shape = generateBracket(params);
  if (subtipo.includes('TRANSICAO') || subtipo.includes('QUADRADO_REDONDO') || subtipo.includes('REDUCAO')) shape = generateTransitionShape(params);

  const dims = [
    generateLinearDimension(140, 340, 420, 340, `L=${params.comprimentoTotal || params.comprimento || params.base || 0}mm`),
    generateTextLabel(60, 60, 'VISTA FRONTAL'),
  ].join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560" width="100%" height="100%">
    ${generateGrid()}
    ${generateDrawingFrame()}
    ${shape}
    ${dims}
    ${generateTitleBlock(data)}
  </svg>`;
}

module.exports = {
  generateDrawingFrame,
  generateGrid,
  generateTitleBlock,
  generateLinearDimension,
  generateCenterLine,
  generateTextLabel,
  generateCircle,
  generateRect,
  generateSteppedShaft,
  generateFlange,
  generatePlate,
  generateBracket,
  generateTransitionShape,
  renderTechnicalDrawing,
};
