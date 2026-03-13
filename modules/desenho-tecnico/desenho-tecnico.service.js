const repo = require('./desenho-tecnico.repository');
const svg = require('./desenho-tecnico.svg.service');
const pdf = require('./desenho-tecnico.pdf.service');

function parseParams(raw = {}) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_e) { return {}; }
  }
  return raw || {};
}

function list(filters) { return repo.list(filters); }
function getById(id) { return repo.getById(id); }

function create(payload) {
  return repo.create({
    ...payload,
    descricao: payload.descricao || null,
    material: payload.material || null,
    observacoes: payload.observacoes || null,
    historico_revisao: payload.historico_revisao || 'Criação inicial',
    status: payload.status || 'ATIVO',
    revisao: Number(payload.revisao || 0),
  });
}

function update(id, payload) {
  return repo.update(id, {
    ...payload,
    revisao: Number(payload.revisao || 0),
    status: payload.status || 'ATIVO',
  });
}

function inactivate(id) { return repo.inactivate(id); }

function duplicate(id, userId) {
  const code = `DT-${Date.now()}`;
  return repo.duplicate(id, code, userId);
}

function generateSvg(desenho, params) {
  return svg.renderTechnicalDrawing({ ...desenho, params: parseParams(params || desenho.props_json || {}) });
}

async function generatePdf(desenho, params) {
  const svgMarkup = generateSvg(desenho, params);
  const pdfInfo = await pdf.generateTechnicalPdf(desenho, svgMarkup);
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
  list,
  getById,
  create,
  update,
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
