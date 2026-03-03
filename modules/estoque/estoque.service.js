const db = require("../../database/db");

function hasColumn(table, column) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  } catch (_e) {
    return false;
  }
}

const HAS_SALDO_ATUAL = hasColumn("estoque_itens", "saldo_atual");
const HAS_SALDO_MINIMO = hasColumn("estoque_itens", "saldo_minimo");
const HAS_ESTOQUE_MIN = hasColumn("estoque_itens", "estoque_min");
const HAS_DATA_MOV = hasColumn("estoque_movimentos", "data_mov");
const HAS_CATEGORIA_ID = hasColumn("estoque_itens", "categoria_id");
const HAS_LOCAL_ID = hasColumn("estoque_itens", "local_id");

const saldoExpr = HAS_SALDO_ATUAL ? "COALESCE(i.saldo_atual, 0)" : "COALESCE(v.saldo, 0)";
const minimoExpr = HAS_SALDO_MINIMO
  ? "COALESCE(i.saldo_minimo, 0)"
  : HAS_ESTOQUE_MIN
    ? "COALESCE(i.estoque_min, 0)"
    : "0";

function dashboard() {
  const itens = db.prepare("SELECT COUNT(*) AS total FROM estoque_itens WHERE ativo = 1").get()?.total || 0;
  const baixo =
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM estoque_itens i
         LEFT JOIN vw_estoque_saldo v ON v.item_id = i.id
         WHERE i.ativo = 1 AND ${saldoExpr} < ${minimoExpr}`
      )
      .get()?.total || 0;
  const saldo =
    db
      .prepare(
        `SELECT COALESCE(SUM(${saldoExpr}), 0) AS total
         FROM estoque_itens i
         LEFT JOIN vw_estoque_saldo v ON v.item_id = i.id
         WHERE i.ativo = 1`
      )
      .get()?.total || 0;

  return { itens, baixo, saldo };
}

function listItens() {
  const selectCategoria = HAS_CATEGORIA_ID ? "c.nome AS categoria_nome" : "NULL AS categoria_nome";
  const selectLocal = HAS_LOCAL_ID ? "l.nome AS local_nome" : "NULL AS local_nome";
  const joinCategoria = HAS_CATEGORIA_ID ? "LEFT JOIN estoque_categorias c ON c.id = i.categoria_id" : "";
  const joinLocal = HAS_LOCAL_ID ? "LEFT JOIN estoque_locais l ON l.id = i.local_id" : "";

  return db
    .prepare(
      `SELECT i.id, i.codigo, i.nome, i.unidade,
              ${saldoExpr} AS saldo_atual,
              ${minimoExpr} AS saldo_minimo,
              ${selectCategoria},
              ${selectLocal}
       FROM estoque_itens i
       ${joinCategoria}
       ${joinLocal}
       LEFT JOIN vw_estoque_saldo v ON v.item_id = i.id
       WHERE i.ativo = 1
       ORDER BY i.nome`
    )
    .all();
}

function listCategorias() {
  return db.prepare("SELECT id, nome, parent_id, ativo, created_at FROM estoque_categorias WHERE ativo = 1 ORDER BY nome").all();
}

function listLocais() {
  return db.prepare("SELECT id, nome, descricao, ativo, created_at FROM estoque_locais WHERE ativo = 1 ORDER BY nome").all();
}

function listMovimentos({ tipo, item_id } = {}) {
  const where = [];
  const params = [];

  if (tipo) {
    where.push("m.tipo = ?");
    params.push(tipo);
  }

  if (item_id) {
    where.push("m.item_id = ?");
    params.push(Number(item_id));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return db
    .prepare(
      `SELECT m.*, ${HAS_DATA_MOV ? "COALESCE(m.data_mov, m.created_at)" : "m.created_at"} AS data_mov,
              i.nome AS item_nome,
              i.unidade AS item_unidade,
              u.name AS usuario_nome
       FROM estoque_movimentos m
       JOIN estoque_itens i ON i.id = m.item_id
       LEFT JOIN users u ON u.id = m.usuario_id
       ${whereSql}
       ORDER BY m.id DESC
       LIMIT 300`
    )
    .all(...params);
}

function createCategoria({ nome, parent_id }) {
  if (!nome || String(nome).trim().length < 2) throw new Error("Informe um nome válido.");
  db.prepare("INSERT INTO estoque_categorias (nome, parent_id, ativo, created_at) VALUES (?, ?, 1, datetime('now'))").run(String(nome).trim(), parent_id ? Number(parent_id) : null);
}

function createLocal({ nome, descricao }) {
  if (!nome || String(nome).trim().length < 2) throw new Error("Informe um nome válido.");
  db.prepare("INSERT INTO estoque_locais (nome, descricao, ativo, created_at) VALUES (?, ?, 1, datetime('now'))").run(String(nome).trim(), descricao ? String(descricao).trim() : null);
}

function getItemById(id) {
  return db
    .prepare(
      `SELECT i.id, i.nome, i.unidade,
              ${saldoExpr} AS saldo_atual
       FROM estoque_itens i
       LEFT JOIN vw_estoque_saldo v ON v.item_id = i.id
       WHERE i.id = ?`
    )
    .get(id);
}

function registrarSaida({ item_id, quantidade, usuario_id, observacao, referencia_id }) {
  const item = getItemById(Number(item_id));
  if (!item) throw new Error("Item não encontrado.");

  const qtd = Number(String(quantidade || "0").replace(",", "."));
  if (!Number.isFinite(qtd) || qtd <= 0) throw new Error("Quantidade inválida.");
  if (qtd > Number(item.saldo_atual || 0)) throw new Error("Saldo insuficiente para a saída.");

  db.transaction(() => {
    if (HAS_SALDO_ATUAL) {
      db.prepare("UPDATE estoque_itens SET saldo_atual = COALESCE(saldo_atual, 0) - ?, updated_at = datetime('now') WHERE id = ?").run(qtd, item.id);
    }

    db.prepare(
      `INSERT INTO estoque_movimentos (
         tipo, ${HAS_DATA_MOV ? "data_mov," : ""} item_id, quantidade, usuario_id, referencia_tipo, referencia_id, observacao, created_at
       ) VALUES (
         'SAIDA_REQUISICAO_INTERNA', ${HAS_DATA_MOV ? "datetime('now')," : ""} ?, ?, ?, 'SOLICITACAO', ?, ?, datetime('now')
       )`
    ).run(item.id, qtd, usuario_id || null, referencia_id ? Number(referencia_id) : null, observacao ? String(observacao).trim() : null);
  })();
}

module.exports = {
  dashboard,
  listItens,
  listCategorias,
  listLocais,
  listMovimentos,
  createCategoria,
  createLocal,
  registrarSaida,
};
