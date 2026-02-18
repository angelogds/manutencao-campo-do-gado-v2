const db = require("../../database/db");

function listSolicitacoes() {
  return db.prepare(`
    SELECT s.id, s.solicitante, s.setor, s.status, s.observacao, s.created_at,
           v.tipo_origem, v.destino_uso,
           e.nome AS equipamento_nome
    FROM solicitacoes_compra s
    LEFT JOIN solicitacao_vinculos v ON v.solicitacao_id = s.id
    LEFT JOIN equipamentos e ON e.id = v.equipamento_id
    ORDER BY s.id DESC
  `).all();
}

function listEquipamentos() {
  return db.prepare(`SELECT id, nome FROM equipamentos WHERE ativo = 1 ORDER BY nome`).all();
}

function createSolicitacao({ solicitante, setor, observacao, itens, vinculo, createdBy }) {
  const insertSolic = db.prepare(`
    INSERT INTO solicitacoes_compra (solicitante, setor, status, observacao, created_by, created_at)
    VALUES (?, ?, 'aberta', ?, ?, datetime('now'))
  `);

  const insertItem = db.prepare(`
    INSERT INTO solicitacao_itens (solicitacao_id, item_id, descricao, quantidade, unidade, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertVinculo = db.prepare(`
    INSERT INTO solicitacao_vinculos (solicitacao_id, tipo_origem, origem_id, equipamento_id, destino_uso, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  return db.transaction(() => {
    const info = insertSolic.run(solicitante, setor || "MANUTENCAO", observacao || null, createdBy || null);
    const solicitacaoId = Number(info.lastInsertRowid);

    for (const it of itens || []) {
      insertItem.run(
        solicitacaoId,
        it.item_id ? Number(it.item_id) : null,
        String(it.descricao || "").trim(),
        Number(it.quantidade || 1),
        String(it.unidade || "UN").toUpperCase()
      );
    }

    insertVinculo.run(
      solicitacaoId,
      String(vinculo?.tipo_origem || "AVULSA").toUpperCase(),
      vinculo?.origem_id ? Number(vinculo.origem_id) : null,
      vinculo?.equipamento_id ? Number(vinculo.equipamento_id) : null,
      vinculo?.destino_uso ? String(vinculo.destino_uso).trim() : null
    );

    return solicitacaoId;
  })();
}

function getSolicitacaoById(id) {
  const sol = db.prepare(`
    SELECT s.id, s.solicitante, s.setor, s.status, s.observacao, s.created_at,
           v.tipo_origem, v.origem_id, v.destino_uso, v.equipamento_id,
           e.nome AS equipamento_nome
    FROM solicitacoes_compra s
    LEFT JOIN solicitacao_vinculos v ON v.solicitacao_id = s.id
    LEFT JOIN equipamentos e ON e.id = v.equipamento_id
    WHERE s.id = ?
  `).get(id);

  if (!sol) return null;

  const itens = db.prepare(`
    SELECT si.id, si.item_id, si.descricao, si.quantidade, si.unidade,
           ei.codigo AS estoque_codigo, ei.nome AS estoque_nome,
           COALESCE(vs.saldo, 0) AS saldo_atual
    FROM solicitacao_itens si
    LEFT JOIN estoque_itens ei ON ei.id = si.item_id
    LEFT JOIN vw_estoque_saldo vs ON vs.item_id = si.item_id
    WHERE si.solicitacao_id = ?
    ORDER BY si.id
  `).all(id);

  const cotacoes = db.prepare(`
    SELECT id, fornecedor, valor_total, observacao, anexo_path, created_at
    FROM solicitacao_cotacoes
    WHERE solicitacao_id = ?
    ORDER BY id DESC
  `).all(id);

  return { ...sol, itens, cotacoes };
}

function updateStatus(id, status) {
  db.prepare(`UPDATE solicitacoes_compra SET status = ? WHERE id = ?`).run(String(status || "").toLowerCase(), id);
}

function addCotacao(solicitacaoId, { fornecedor, valor_total, observacao, anexo_path }) {
  db.prepare(`
    INSERT INTO solicitacao_cotacoes (solicitacao_id, fornecedor, valor_total, observacao, anexo_path, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(solicitacaoId, fornecedor, Number(valor_total || 0), observacao || null, anexo_path || null);
}

module.exports = {
  listSolicitacoes,
  listEquipamentos,
  createSolicitacao,
  getSolicitacaoById,
  updateStatus,
  addCotacao,
};
