const repo = require('./desenho-tecnico.repository');
const svg = require('./desenho-tecnico.svg.service');
const pdf = require('./desenho-tecnico.pdf.service');

const CAD_LAYERS = ['geometria_principal', 'linhas_de_centro', 'cotas', 'textos', 'furos', 'construcao', 'observacoes'];

function parseParams(raw = {}) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_e) { return {}; }
  }
  return raw || {};
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_e) { return fallback; }
}

function list(filters) { return repo.list(filters); }
function getById(id) {
  const desenho = repo.getById(id);
  if (!desenho) return null;
  return {
    ...desenho,
    cad_data: parseJson(desenho.json_cad, null),
    preview3d: parseJson(desenho.json_3d, null),
  };
}

function create(payload) {
  return repo.create({
    ...payload,
    descricao: payload.descricao || null,
    material: payload.material || null,
    observacoes: payload.observacoes || null,
    historico_revisao: payload.historico_revisao || 'Criação inicial',
    status: payload.status || 'ATIVO',
    revisao: Number(payload.revisao || 0),
    tipo_origem: payload.tipo_origem || 'parametrico',
    modo_cad_ativo: Number(payload.modo_cad_ativo || 0),
    json_cad: payload.json_cad || null,
    json_3d: payload.json_3d || null,
    preview_3d_path: payload.preview_3d_path || null,
  });
}

function update(id, payload) {
  return repo.update(id, {
    ...payload,
    revisao: Number(payload.revisao || 0),
    status: payload.status || 'ATIVO',
    tipo_origem: payload.tipo_origem || 'parametrico',
    modo_cad_ativo: Number(payload.modo_cad_ativo || 0),
  });
}

function saveCad(desenhoId, cadData, userId) {
  const payload = typeof cadData === 'string' ? JSON.parse(cadData) : cadData;
  const objetos = Array.isArray(payload.objects) ? payload.objects : [];

  if (!objetos.length) throw new Error('Não é permitido salvar desenho CAD vazio.');

  for (const obj of objetos) {
    if (obj.radius != null && Number(obj.radius) <= 0) throw new Error('Raio inválido.');
    if (obj.thickness != null && Number(obj.thickness) < 0) throw new Error('Espessura negativa não permitida.');
    if (obj.type === 'text' && (!Number.isFinite(Number(obj.x)) || !Number.isFinite(Number(obj.y)))) throw new Error('Texto sem posição válida.');
  }

  const compatible3d = isCad3dCompatible(payload);
  const preview3d = compatible3d ? build3dFromCad(payload) : null;

  repo.updateCadData(desenhoId, {
    json_cad: JSON.stringify(payload),
    json_3d: preview3d ? JSON.stringify(preview3d) : null,
  });
  repo.replaceCadObjects(desenhoId, objetos);
  repo.insertCadHistory(desenhoId, 'save', JSON.stringify({ totalObjetos: objetos.length, compatible3d }), userId);
  return { compatible3d, preview3d };
}

function isCad3dCompatible(payload = {}) {
  const objects = Array.isArray(payload.objects) ? payload.objects : [];
  const closedShapes = objects.filter((o) => ['rect', 'circle', 'polyline'].includes(o.type));
  return closedShapes.length > 0;
}

function build3dFromCad(payload = {}) {
  const objects = Array.isArray(payload.objects) ? payload.objects : [];
  const extrudables = objects
    .filter((o) => ['rect', 'circle', 'polyline'].includes(o.type))
    .map((o) => ({
      type: o.type,
      x: Number(o.x || 0),
      y: Number(o.y || 0),
      width: Number(o.width || 0),
      height: Number(o.height || 0),
      radius: Number(o.radius || 0),
      points: o.points || [],
      thickness: Number(o.thickness || payload.defaultThickness || 10),
      layer: o.layer || 'geometria_principal',
    }));

  return {
    mode: 'simple-extrusion',
    generatedAt: new Date().toISOString(),
    items: extrudables,
  };
}

function inactivate(id) { return repo.inactivate(id); }

function duplicate(id, userId) {
  const code = `DT-${Date.now()}`;
  return repo.duplicate(id, code, userId);
}

function generateSvg(desenho, params) {
  if (desenho.tipo_origem === 'cad') {
    return svg.renderCadDrawing(parseJson(desenho.json_cad, { objects: [] }));
  }
  return svg.renderTechnicalDrawing({ ...desenho, params: parseParams(params || desenho.props_json || {}) });
}

async function generatePdf(desenho, params) {
  const svgMarkup = generateSvg(desenho, params);
  const pdfInfo = await pdf.generateTechnicalPdf(desenho, svgMarkup, {
    tipoOrigem: desenho.tipo_origem || 'parametrico',
    preview3d: parseJson(desenho.json_3d, null),
  });
  repo.saveArquivo(desenho.id, {
    tipo_arquivo: 'PDF',
    arquivo_pdf: pdfInfo.relPath,
    svg_source: svgMarkup,
    preview_path: null,
    revisao: desenho.revisao,
  });
  return { ...pdfInfo, svgMarkup };
}

function saveSvgRevision(desenho, params) {
  const svgMarkup = generateSvg(desenho, params);
  repo.saveArquivo(desenho.id, {
    tipo_arquivo: 'SVG',
    svg_source: svgMarkup,
    arquivo_pdf: null,
    preview_path: null,
    revisao: desenho.revisao,
  });
  return svgMarkup;
}

function listRevisoes(id) { return repo.listRevisoes(id); }
function listBiblioteca(filters) { return repo.listBiblioteca(filters); }
function vincularEquipamento(desenhoId, equipamentoId, posicaoAplicacao, observacao) { return repo.vincularEquipamento(desenhoId, equipamentoId, posicaoAplicacao, observacao); }
function listByEquipamento(equipamentoId) { return repo.listAplicacoesByEquipamento(equipamentoId); }

module.exports = {
  CAD_LAYERS,
  list,
  getById,
  create,
  update,
  saveCad,
  isCad3dCompatible,
  build3dFromCad,
  inactivate,
  duplicate,
  generateSvg,
  saveSvgRevision,
  generatePdf,
  listRevisoes,
  listBiblioteca,
  vincularEquipamento,
  listByEquipamento,
};
