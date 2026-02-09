// modules/compras/compras.service.js
const db = require("../../database/db");

/**
 * SOLICITAÇÕES
 */
function listSolicitacoes() {
  return db
    .prepare(
      `SELECT id, solicitante, setor, status, observacao, created_at
       FROM solicitacoes_compra
       ORDER BY id DESC
       LIMIT 200`
    )
    .all();
}

function getSolicitacaoById(id) {
  const cab = db
    .prepare(
      `SELECT id, solicitante, setor, status, observacao, created_at
       FROM solicitacoes_compra
       WHERE id = ?`
    )
    .get(id);

  if (!cab) return null;

  const itens = db
    .prepare(
      `SELECT id, solicitacao_id, item_id, descricao, quantidade, unidade, created_at
       FROM solicitacao_itens
       WHERE solicitacao_id = ?
       ORDER BY id ASC`
    )
    .all(id);

  return { ...cab, itens };
}

function createSolicitacao({ solicitante, setor, observacao, itens }) {
  const insertCab = db.prepare(
    `INSERT INTO solicitacoes_compra (solicitante, setor, observacao)
     VALUES (?, ?, ?)`
  );

  const insertItem = db.prepare(
    `INSERT INTO solicitacao_itens (solicitacao_id, item_id, descricao, quantidade, unidade)
     VALUES (?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    const info = insertCab.run(solicitante || "", setor || "", observacao || "");
    const solicitacaoId = info.lastInsertRowid;

    for (const it of itens || []) {
      insertItem.run(
        solicitacaoId,
        it.item_id ?? null,
        it.descricao,
        Number.isFinite(it.quantidade) ? it.quantidade : 1,
        it.unidade || "un"
      );
    }

    return solicitacaoId;
  });

  return tx();
}

function updateSolicitacaoStatus(id, status) {
  // status permitido: aberta|cotacao|aprovada|comprada|recebida|cancelada
  db.prepare(`UPDATE solicitacoes_compra SET status = ? WHERE id = ?`).run(status, id);
}

/**
 * COMPRAS
 */
function listCompras() {
  return db
    .prepare(
      `SELECT c.id, c.solicitacao_id, c.fornecedor, c.status, c.data_compra, c.data_recebimento, c.observacao, c.created_at
       FROM compras c
       ORDER BY c.id DESC
       LIMIT 200`
    )
    .all();
}

function getCompraById(id) {
  const cab = db
    .prepare(
      `SELECT id, solicitacao_id, fornecedor, status, data_compra, data_recebimento, observacao, created_at
       FROM compras
       WHERE id = ?`
    )
    .get(id);

  if (!cab) return null;

  const itens = db
    .prepare(
      `SELECT id, compra_id, item_id, descricao, quantidade, custo_unit, unidade, created_at
       FROM compra_itens
       WHERE compra_id = ?
       ORDER BY id ASC`
    )
    .all(id);

  return { ...cab, itens };
}

function createCompra({ solicitacao_id, fornecedor, status, data_compra, observacao }) {
  const insert = db.prepare(
    `INSERT INTO compras (solicitacao_id, fornecedor, status, data_compra, observacao)
     VALUES (?, ?, ?, ?, ?)`
  );

  const info = insert.run(
    solicitacao_id || null,
    fornecedor || "",
    status || "em_andamento",
    data_compra || null,
    observacao || ""
  );

  return info.lastInsertRowid;
}

function updateCompraStatus(id, status) {
  // status: em_andamento|recebida|cancelada
  db.prepare(`UPDATE compras SET status = ? WHERE id = ?`).run(status, id);
}

module.exports = {
  // solicitações
  listSolicitacoes,
  getSolicitacaoById,
  createSolicitacao,
  updateSolicitacaoStatus,
  // compras
  listCompras,
  getCompraById,
  createCompra,
  updateCompraStatus,
};
