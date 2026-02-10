// modules/estoque/estoque.service.js
const db = require("../../database/db");

function getCards() {
  const itens_estoque =
    db.prepare(`SELECT COUNT(*) AS total FROM estoque_itens WHERE ativo = 1`).get()?.total || 0;

  const abaixo_minimo =
    db.prepare(`
      SELECT COUNT(*) AS total
      FROM vw_estoque_saldo s
      JOIN estoque_itens i ON i.id = s.item_id
      WHERE i.ativo = 1 AND s.saldo < COALESCE(i.estoque_min,0)
    `).get()?.total || 0;

  const saldo_total =
    db.prepare(`
      SELECT COALESCE(SUM(saldo),0) AS total
      FROM vw_estoque_saldo
    `).get()?.total || 0;

  return { itens_estoque, abaixo_minimo, saldo_total };
}

function listItens({ q = "", onlyBelowMin = false } = {}) {
  const like = `%${q}%`;

  if (onlyBelowMin) {
    return db.prepare(`
      SELECT i.id, i.codigo, i.nome, i.unidade, i.estoque_min, i.custo_unit, i.ativo,
             COALESCE(s.saldo,0) AS saldo
      FROM estoque_itens i
      LEFT JOIN vw_estoque_saldo s ON s.item_id = i.id
      WHERE i.ativo = 1
        AND (i.nome LIKE ? OR i.codigo LIKE ?)
        AND COALESCE(s.saldo,0) < COALESCE(i.estoque_min,0)
      ORDER BY i.nome ASC
    `).all(like, like);
  }

  return db.prepare(`
    SELECT i.id, i.codigo, i.nome, i.unidade, i.estoque_min, i.custo_unit, i.ativo,
           COALESCE(s.saldo,0) AS saldo
    FROM estoque_itens i
    LEFT JOIN vw_estoque_saldo s ON s.item_id = i.id
    WHERE i.ativo = 1
      AND (i.nome LIKE ? OR i.codigo LIKE ?)
    ORDER BY i.nome ASC
  `).all(like, like);
}

function createItem({ codigo, nome, unidade, estoque_min, custo_unit }) {
  const stmt = db.prepare(`
    INSERT INTO estoque_itens (codigo, nome, unidade, estoque_min, custo_unit, ativo)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const info = stmt.run(codigo || null, nome, unidade || "un", estoque_min || 0, custo_unit || 0);
  return info.lastInsertRowid;
}

function getItemById(id) {
  const item = db.prepare(`
    SELECT i.id, i.codigo, i.nome, i.unidade, i.estoque_min, i.custo_unit, i.ativo, i.created_at,
           COALESCE(s.saldo,0) AS saldo
    FROM estoque_itens i
    LEFT JOIN vw_estoque_saldo s ON s.item_id = i.id
    WHERE i.id = ?
  `).get(id);

  return item || null;
}

function listMovimentosByItem(itemId) {
  return db.prepare(`
    SELECT id, tipo, quantidade, custo_unit, origem, referencia_id, observacao, created_at
    FROM estoque_movimentos
    WHERE item_id = ?
    ORDER BY id DESC
    LIMIT 200
  `).all(itemId);
}

function createMovimento({ item_id, tipo, quantidade, custo_unit, origem, observacao }) {
  const allowed = new Set(["entrada", "saida", "ajuste"]);
  if (!allowed.has(tipo)) throw new Error("Tipo inválido. Use: entrada, saida ou ajuste.");

  const stmt = db.prepare(`
    INSERT INTO estoque_movimentos (item_id, tipo, quantidade, custo_unit, origem, observacao)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(item_id, tipo, quantidade, custo_unit, origem || null, observacao || null);
}

module.exports = {
  getCards,
  listItens,
  createItem,
  getItemById,
  listMovimentosByItem,
  createMovimento,
};
