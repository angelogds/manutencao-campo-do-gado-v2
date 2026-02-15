// modules/compras/compras.service.js
const db = require("../../database/db");

// ===== SOLICITAÇÕES =====
function listSolicitacoes() {
  return db
    .prepare(
      `
      SELECT id, solicitante, setor, status, observacao, created_at
      FROM solicitacoes_compra
      ORDER BY id DESC
    `
    )
    .all();
}

function getSolicitacaoById(id) {
  const sol = db
    .prepare(
      `
      SELECT id, solicitante, setor, status, observacao, created_at
      FROM solicitacoes_compra
      WHERE id=?
    `
    )
    .get(id);

  if (!sol) return null;

  const itens = db
    .prepare(
      `
      SELECT si.id, si.item_id, si.descricao, si.quantidade, si.unidade, si.created_at,
             ei.codigo AS estoque_codigo, ei.nome AS estoque_nome
      FROM solicitacao_itens si
      LEFT JOIN estoque_itens ei ON ei.id = si.item_id
      WHERE si.solicitacao_id=?
      ORDER BY si.id ASC
    `
    )
    .all(id);

  return { ...sol, itens };
}

function createSolicitacao({ solicitante, setor, observacao, itens }) {
  const insertSolic = db.prepare(`
    INSERT INTO solicitacoes_compra (solicitante, setor, status, observacao, created_at)
    VALUES (?, ?, 'aberta', ?, datetime('now'))
  `);

  const insertItem = db.prepare(`
    INSERT INTO solicitacao_itens (solicitacao_id, item_id, descricao, quantidade, unidade, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  const tx = db.transaction(() => {
    const info = insertSolic.run(solicitante || null, setor || null, observacao || null);
    const solicitacaoId = Number(info.lastInsertRowid);

    for (const it of itens || []) {
      insertItem.run(
        solicitacaoId,
        it.item_id ? Number(it.item_id) : null,
        String(it.descricao || "").trim(),
        Number(it.quantidade || 1),
        String(it.unidade || "un"),
      );
    }

    return solicitacaoId;
  });

  return tx();
}

function updateSolicitacaoStatus(id, status) {
  db.prepare(`UPDATE solicitacoes_compra SET status=? WHERE id=?`).run(status, id);
}

// ===== COMPRAS =====
function listCompras() {
  return db
    .prepare(
      `
      SELECT c.id, c.solicitacao_id, c.fornecedor, c.status,
             c.data_compra, c.data_recebimento, c.observacao, c.created_at
      FROM compras c
      ORDER BY c.id DESC
    `
    )
    .all();
}

function getCompraById(id) {
  const compra = db
    .prepare(
      `
      SELECT c.id, c.solicitacao_id, c.fornecedor, c.status,
             c.data_compra, c.data_recebimento, c.observacao, c.created_at
      FROM compras c
      WHERE c.id=?
    `
    )
    .get(id);

  if (!compra) return null;

  const itens = db
    .prepare(
      `
      SELECT ci.id, ci.compra_id, ci.item_id, ci.descricao, ci.quantidade, ci.unidade, ci.custo_unit, ci.created_at,
             ei.codigo AS estoque_codigo, ei.nome AS estoque_nome
      FROM compra_itens ci
      LEFT JOIN estoque_itens ei ON ei.id = ci.item_id
      WHERE ci.compra_id=?
      ORDER BY ci.id ASC
    `
    )
    .all(id);

  return { ...compra, itens };
}

/**
 * Cria compra:
 * - se vier solicitacaoId: cria itens a partir da solicitação (ou sobrescreve com payload.itens se enviado)
 * - se solicitacaoId for null: cria compra “manual” com payload.itens
 */
function createCompraFromSolicitacao(solicitacaoId, payload = {}) {
  const insertCompra = db.prepare(`
    INSERT INTO compras (solicitacao_id, fornecedor, status, data_compra, observacao, created_at)
    VALUES (?, ?, 'em_andamento', date('now'), ?, datetime('now'))
  `);

  const insertItem = db.prepare(`
    INSERT INTO compra_itens (compra_id, item_id, descricao, quantidade, custo_unit, unidade, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const tx = db.transaction(() => {
    const info = insertCompra.run(
      solicitacaoId ? Number(solicitacaoId) : null,
      payload.fornecedor || null,
      payload.observacao || null
    );

    const compraId = Number(info.lastInsertRowid);

    let itens = payload.itens || [];

    if (solicitacaoId && (!itens || !itens.length)) {
      const sol = getSolicitacaoById(Number(solicitacaoId));
      if (!sol) throw new Error("Solicitação não encontrada para criar compra.");

      itens = (sol.itens || []).map((x) => ({
        item_id: x.item_id ? Number(x.item_id) : null,
        descricao: x.descricao,
        quantidade: Number(x.quantidade || 1),
        unidade: String(x.unidade || "un"),
        custo_unit: 0,
      }));

      updateSolicitacaoStatus(Number(solicitacaoId), "comprada");
    }

    for (const it of itens) {
      insertItem.run(
        compraId,
        it.item_id ? Number(it.item_id) : null,
        String(it.descricao || "").trim(),
        Number(it.quantidade || 0),
        Number(it.custo_unit || 0),
        String(it.unidade || "un")
      );
    }

    return compraId;
  });

  return tx();
}

function updateCompraItensCusto(compraId, itens) {
  const upd = db.prepare(`UPDATE compra_itens SET custo_unit=? WHERE id=? AND compra_id=?`);
  const tx = db.transaction(() => {
    for (const it of itens || []) {
      upd.run(Number(it.custo_unit || 0), Number(it.id), Number(compraId));
    }
  });
  tx();
}

function setCompraStatus(id, status) {
  const compra = getCompraById(id);
  if (!compra) throw new Error("Compra não encontrada.");

  // ✅ Quando recebida: lança entrada no estoque
  if (status === "recebida") {
    const insertMov = db.prepare(`
      INSERT INTO estoque_movimentos (item_id, tipo, quantidade, custo_unit, origem, referencia_id, observacao, created_at)
      VALUES (?, 'entrada', ?, ?, 'compra', ?, ?, datetime('now'))
    `);

    const updateItemCusto = db.prepare(`UPDATE estoque_itens SET custo_unit=? WHERE id=?`);

    const tx = db.transaction(() => {
      db.prepare(`UPDATE compras SET status='recebida', data_recebimento=date('now') WHERE id=?`).run(id);

      for (const it of compra.itens || []) {
        const itemId = it.item_id ? Number(it.item_id) : null;
        if (!itemId) continue;

        const qtd = Number(it.quantidade || 0);
        const custo = Number(it.custo_unit || 0);
        if (qtd <= 0) continue;

        insertMov.run(itemId, qtd, custo, id, `Recebimento compra #${id}`);
        if (custo > 0) updateItemCusto.run(custo, itemId);
      }

      // atualiza solicitação
      if (compra.solicitacao_id) {
        updateSolicitacaoStatus(Number(compra.solicitacao_id), "recebida");
      }
    });

    tx();
    return;
  }

  // demais status
  db.prepare(`UPDATE compras SET status=? WHERE id=?`).run(status, id);
}

function listEstoqueItensAtivos() {
  return db
    .prepare(
      `
      SELECT id, codigo, nome, unidade, custo_unit
      FROM estoque_itens
      WHERE ativo = 1
      ORDER BY nome ASC
    `
    )
    .all();
}

module.exports = {
  listSolicitacoes,
  getSolicitacaoById,
  createSolicitacao,
  updateSolicitacaoStatus,

  listCompras,
  getCompraById,
  createCompraFromSolicitacao,
  updateCompraItensCusto,
  setCompraStatus,

  listEstoqueItensAtivos,
};
