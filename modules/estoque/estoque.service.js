// modules/estoque/estoque.service.js
const db = require("../../database/db");

function listItensComSaldo() {
  return db
    .prepare(
      `SELECT
         s.item_id AS id,
         s.codigo,
         s.nome,
         s.unidade,
         s.saldo,
         i.estoque_min,
         i.custo_unit,
         i.ativo,
         i.created_at
       FROM vw_estoque_saldo s
       JOIN estoque_itens i ON i.id = s.item_id
       ORDER BY s.nome ASC
       LIMIT 500`
    )
    .all();
}

function createItem({ codigo, nome, unidade, estoque_min, custo_unit, ativo }) {
  const stmt = db.prepare(
    `INSERT INTO estoque_itens (codigo, nome, unidade, estoque_min, custo_unit, ativo)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const info = stmt.run(
    codigo,
    nome,
    unidade || "un",
    Number.isFinite(estoque_min) ? estoque_min : 0,
    Number.isFinite(custo_unit) ? custo_unit : 0,
    ativo ? 1 : 0
  );
  return info.lastInsertRowid;
}

function getItemDetalhe(id) {
  const item = db
    .prepare(
      `SELECT
         i.id, i.codigo, i.nome, i.unidade, i.estoque_min, i.custo_unit, i.ativo, i.created_at,
         s.saldo
       FROM estoque_itens i
       LEFT JOIN vw_estoque_saldo s ON s.item_id = i.id
       WHERE i.id = ?`
    )
    .get(id);

  if (!item) return null;

  const movimentos = db
    .prepare(
      `SELECT id, tipo, quantidade, custo_unit, origem, referencia_id, observacao, created_at
       FROM estoque_movimentos
       WHERE item_id = ?
       ORDER BY id DESC
       LIMIT 200`
    )
    .all(id);

  return { ...item, movimentos };
}

function addMovimento({ item_id, tipo, quantidade, custo_unit, origem, referencia_id, observacao }) {
  const stmt = db.prepare(
    `INSERT INTO estoque_movimentos
       (item_id, tipo, quantidade, custo_unit, origem, referencia_id, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  stmt.run(
    item_id,
    tipo,
    quantidade,
    custo_unit,
    origem,
    referencia_id,
    observacao
  );
}

module.exports = {
  listItensComSaldo,
  createItem,
  getItemDetalhe,
  addMovimento,
};
