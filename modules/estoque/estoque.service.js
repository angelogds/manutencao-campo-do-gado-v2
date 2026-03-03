const db = require("../../database/db");

function hasColumn(table, name) {
  try { return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === name); } catch { return false; }
}
const HAS_SALDO_ATUAL = hasColumn("estoque_itens", "saldo_atual");
const HAS_SALDO_MINIMO = hasColumn("estoque_itens", "saldo_minimo");
const HAS_ESTOQUE_MIN = hasColumn("estoque_itens", "estoque_min");

function saldoExpr() { return HAS_SALDO_ATUAL ? "COALESCE(i.saldo_atual,0)" : "COALESCE(v.saldo,0)"; }
function minExpr() { return HAS_SALDO_MINIMO ? "COALESCE(i.saldo_minimo,0)" : (HAS_ESTOQUE_MIN ? "COALESCE(i.estoque_min,0)" : "0"); }

function dashboard() {
  const itens = db.prepare("SELECT COUNT(*) total FROM estoque_itens WHERE ativo=1").get().total;
  const baixo = db.prepare(`SELECT COUNT(*) total FROM estoque_itens i LEFT JOIN vw_estoque_saldo v ON v.item_id=i.id WHERE i.ativo=1 AND ${saldoExpr()} < ${minExpr()}`).get().total;
  const saldo = db.prepare(`SELECT COALESCE(SUM(${saldoExpr()}),0) total FROM estoque_itens i LEFT JOIN vw_estoque_saldo v ON v.item_id=i.id WHERE i.ativo=1`).get().total;
  return { itens, baixo, saldo };
}

function listItens() {
  return db.prepare(`SELECT i.*, c.nome categoria_nome, l.nome local_nome, ${saldoExpr()} AS saldo_atual, ${minExpr()} AS saldo_minimo FROM estoque_itens i LEFT JOIN estoque_categorias c ON c.id=i.categoria_id LEFT JOIN estoque_locais l ON l.id=i.local_id LEFT JOIN vw_estoque_saldo v ON v.item_id=i.id WHERE i.ativo=1 ORDER BY i.nome`).all();
}
function listCategorias() { return db.prepare("SELECT * FROM estoque_categorias WHERE ativo=1 ORDER BY nome").all(); }
function listLocais() { return db.prepare("SELECT * FROM estoque_locais WHERE ativo=1 ORDER BY nome").all(); }
function listMovimentos() { return db.prepare("SELECT m.*, COALESCE(m.data_mov,m.created_at) AS data_mov, i.nome item_nome, u.name usuario_nome FROM estoque_movimentos m JOIN estoque_itens i ON i.id=m.item_id LEFT JOIN users u ON u.id=m.usuario_id ORDER BY m.id DESC LIMIT 300").all(); }

function createCategoria({ nome, parent_id }) { db.prepare("INSERT INTO estoque_categorias (nome,parent_id) VALUES (?,?)").run(nome, parent_id || null); }
function createLocal({ nome, descricao }) { db.prepare("INSERT INTO estoque_locais (nome,descricao) VALUES (?,?)").run(nome, descricao || null); }
function createItem(data) { return Number(db.prepare(`INSERT INTO estoque_itens (codigo,nome,unidade,categoria_id,local_id,${HAS_SALDO_MINIMO ? "saldo_minimo" : HAS_ESTOQUE_MIN ? "estoque_min" : "categoria"}) VALUES (?,?,?,?,?,?)`).run(data.codigo||null, data.nome, data.unidade||'UN', data.categoria_id||null, data.local_id||null, Number(data.saldo_minimo||0)).lastInsertRowid); }
function getItem(id) { return db.prepare(`SELECT i.*, ${saldoExpr()} AS saldo_atual, ${minExpr()} AS saldo_minimo FROM estoque_itens i LEFT JOIN vw_estoque_saldo v ON v.item_id=i.id WHERE i.id=?`).get(id); }

function registrarSaida({ item_id, quantidade, usuario_id, observacao, referencia_id }) {
  const item = getItem(item_id); if (!item) throw new Error("Item não encontrado");
  const qtd = Number(quantidade); if (qtd <= 0) throw new Error("Quantidade inválida"); if (qtd > Number(item.saldo_atual || 0)) throw new Error("Saldo insuficiente");
  db.transaction(() => {
    if (HAS_SALDO_ATUAL) db.prepare("UPDATE estoque_itens SET saldo_atual=COALESCE(saldo_atual,0)-? WHERE id=?").run(qtd, item_id);
    db.prepare("INSERT INTO estoque_movimentos (tipo,item_id,quantidade,usuario_id,referencia_tipo,referencia_id,observacao,created_at) VALUES ('SAIDA_REQUISICAO_INTERNA',?,?,?,?,?,?,datetime('now'))")
      .run(item_id, qtd, usuario_id || null, 'SOLICITACAO', referencia_id || null, observacao || null);
  })();
}

module.exports = { dashboard, listItens, listCategorias, listLocais, listMovimentos, createCategoria, createLocal, createItem, getItem, registrarSaida };
