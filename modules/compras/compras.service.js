// modules/compras/compras.service.js
const db = require("../../database/db");

// ===== Helpers =====
function nowBR() {
  // grava em UTC-3 no formato sqlite
  return "datetime('now','-3 hours')";
}

// ============ SOLICITAÇÕES ============
function listSolicitacoes() {
  return db.prepare(`
    SELECT
      id, titulo, urgencia, status, created_at
    FROM compras_solicitacoes
    ORDER BY created_at DESC
  `).all();
}

function listSolicitacoesAprovadas() {
  return db.prepare(`
    SELECT id, titulo, urgencia, status, created_at
    FROM compras_solicitacoes
    WHERE status IN ('APROVADA','APROVADO')
    ORDER BY created_at DESC
  `).all();
}

function getSolicitacaoById(id) {
  return db.prepare(`
    SELECT *
    FROM compras_solicitacoes
    WHERE id=?
    LIMIT 1
  `).get(id);
}

function createSolicitacao({ titulo, descricao, urgencia, criado_por }) {
  const info = db.prepare(`
    INSERT INTO compras_solicitacoes
      (titulo, descricao, urgencia, status, criado_por, created_at, updated_at)
    VALUES
      (?, ?, ?, 'ABERTA', ?, ${nowBR()}, ${nowBR()})
  `).run(
    String(titulo || "").trim(),
    String(descricao || "").trim(),
    String(urgencia || "NORMAL").trim(),
    criado_por
  );

  return Number(info.lastInsertRowid);
}

function updateSolicitacaoStatus(id, status, userId) {
  const st = String(status || "").trim().toUpperCase();
  db.prepare(`
    UPDATE compras_solicitacoes
    SET status=?, atualizado_por=?, updated_at=${nowBR()}
    WHERE id=?
  `).run(st, userId, id);
}

// ============ COMPRAS ============
function listCompras() {
  return db.prepare(`
    SELECT
      c.id, c.status, c.fornecedor, c.numero_nf, c.valor_total, c.created_at,
      s.id AS solicitacao_id, s.titulo AS solicitacao_titulo
    FROM compras c
    LEFT JOIN compras_solicitacoes s ON s.id = c.solicitacao_id
    ORDER BY c.created_at DESC
  `).all();
}

function getCompraById(id) {
  return db.prepare(`
    SELECT
      c.*,
      s.titulo AS solicitacao_titulo
    FROM compras c
    LEFT JOIN compras_solicitacoes s ON s.id = c.solicitacao_id
    WHERE c.id=?
    LIMIT 1
  `).get(id);
}

function createCompra({ solicitacao_id, fornecedor, numero_nf, valor_total, observacao, criado_por }) {
  const info = db.prepare(`
    INSERT INTO compras
      (solicitacao_id, fornecedor, numero_nf, valor_total, observacao, status, criado_por, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, 'ABERTA', ?, ${nowBR()}, ${nowBR()})
  `).run(
    solicitacao_id,
    String(fornecedor || "").trim(),
    String(numero_nf || "").trim(),
    valor_total ? Number(valor_total) : 0,
    String(observacao || "").trim(),
    criado_por
  );

  return Number(info.lastInsertRowid);
}

function updateCompraStatus(id, status, userId) {
  const st = String(status || "").trim().toUpperCase();
  db.prepare(`
    UPDATE compras
    SET status=?, atualizado_por=?, updated_at=${nowBR()}
    WHERE id=?
  `).run(st, userId, id);
}

module.exports = {
  // solicitacoes
  listSolicitacoes,
  listSolicitacoesAprovadas,
  getSolicitacaoById,
  createSolicitacao,
  updateSolicitacaoStatus,
  // compras
  listCompras,
  getCompraById,
  createCompra,
  updateCompraStatus,
};
