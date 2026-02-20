const db = require("../../database/db");

function listFuncionarios() {
  return db.prepare(`SELECT id, codigo, nome FROM almox_funcionarios WHERE ativo = 1 ORDER BY nome`).all();
}

function createFuncionario({ codigo, nome }) {
  const info = db.prepare(`
    INSERT INTO almox_funcionarios (codigo, nome, ativo, created_at)
    VALUES (?, ?, 1, datetime('now'))
  `).run(String(codigo).trim(), String(nome).trim());
  return Number(info.lastInsertRowid);
}

function listItensEstoque() {
  return db.prepare(`
    SELECT i.id, i.codigo, i.nome, i.unidade, COALESCE(v.saldo, 0) AS saldo
    FROM estoque_itens i
    LEFT JOIN vw_estoque_saldo v ON v.item_id = i.id
    WHERE i.ativo = 1
    ORDER BY i.nome
  `).all();
}

function listSolicitacoesAbertas() {
  return db.prepare(`
    SELECT id, status, setor
    FROM solicitacoes_compra
    WHERE status IN ('aberta','em_cotacao','liberada','aprovada_compra')
    ORDER BY id DESC
    LIMIT 100
  `).all();
}

function registrarRetirada({ funcionario_id, item_id, quantidade, finalidade, destino, solicitacao_id, created_by }) {
  const saldo = db.prepare(`SELECT COALESCE(saldo, 0) AS saldo FROM vw_estoque_saldo WHERE item_id = ?`).get(item_id)?.saldo || 0;
  if (Number(quantidade) <= 0) throw new Error("Quantidade inválida.");
  if (Number(quantidade) > Number(saldo)) throw new Error("Saldo insuficiente no estoque.");

  return db.transaction(() => {
    const ret = db.prepare(`
      INSERT INTO almox_retiradas (
        funcionario_id, item_id, quantidade, finalidade, destino, solicitacao_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      Number(funcionario_id),
      Number(item_id),
      Number(quantidade),
      finalidade || null,
      destino || null,
      solicitacao_id ? Number(solicitacao_id) : null,
      created_by || null
    );

    db.prepare(`
      INSERT INTO estoque_movimentos (item_id, tipo, quantidade, origem, referencia_id, observacao, created_at)
      VALUES (?, 'saida', ?, 'almoxarifado', ?, ?, datetime('now'))
    `).run(
      Number(item_id),
      Number(quantidade),
      Number(ret.lastInsertRowid),
      `Retirada almoxarifado para ${destino || "uso geral"}`
    );

    return Number(ret.lastInsertRowid);
  })();
}

function listRetiradas() {
  return db.prepare(`
    SELECT r.id, r.quantidade, r.finalidade, r.destino, r.created_at,
           f.codigo AS funcionario_codigo, f.nome AS funcionario_nome,
           i.nome AS item_nome, i.unidade,
           r.solicitacao_id
    FROM almox_retiradas r
    JOIN almox_funcionarios f ON f.id = r.funcionario_id
    JOIN estoque_itens i ON i.id = r.item_id
    ORDER BY r.id DESC
    LIMIT 200
  `).all();
}

module.exports = {
  listFuncionarios,
  createFuncionario,
  listItensEstoque,
  listSolicitacoesAbertas,
  registrarRetirada,
  listRetiradas,
};
