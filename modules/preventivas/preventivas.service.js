const db = require("../../database/db");

function listPlanos() {
  return db.prepare(`
    SELECT p.*,
           e.nome AS equipamento_nome,
           e.codigo AS equipamento_codigo,
           ex.id AS execucao_id,
           ex.status AS execucao_status,
           ex.responsavel AS execucao_responsavel,
           ex.data_prevista AS execucao_data_prevista,
           ex.data_executada AS execucao_data_executada,
           ex.observacao AS execucao_observacao,
           ex.created_at AS execucao_created_at
    FROM preventiva_planos p
    LEFT JOIN equipamentos e ON e.id = p.equipamento_id
    LEFT JOIN preventiva_execucoes ex ON ex.id = (
      SELECT pe2.id
      FROM preventiva_execucoes pe2
      WHERE pe2.plano_id = p.id
      ORDER BY
        CASE pe2.status
          WHEN 'atrasada' THEN 1
          WHEN 'pendente' THEN 2
          WHEN 'executada' THEN 3
          WHEN 'cancelada' THEN 4
          ELSE 9
        END,
        COALESCE(pe2.data_prevista, '9999-12-31') ASC,
        pe2.id DESC
      LIMIT 1
    )
    ORDER BY p.ativo DESC, p.id DESC
  `).all();
}

function listEquipamentosAtivos() {
  return db.prepare(`
    SELECT id, codigo, nome
    FROM equipamentos
    WHERE ativo = 1
    ORDER BY nome
  `).all();
}

function createPlano(data) {
  const stmt = db.prepare(`
    INSERT INTO preventiva_planos (
      equipamento_id, titulo, frequencia_tipo, frequencia_valor,
      ativo, observacao
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const r = stmt.run(
    data.equipamento_id ? Number(data.equipamento_id) : null,
    String(data.titulo || "").trim(),
    String(data.frequencia_tipo || "mensal").trim(),
    Number(data.frequencia_valor || 1),
    data.ativo ? 1 : 0,
    String(data.observacao || "").trim()
  );

  return Number(r.lastInsertRowid);
}

function getPlanoById(id) {
  return db.prepare(`
    SELECT p.*,
           e.nome AS equipamento_nome,
           e.codigo AS equipamento_codigo,
           e.setor AS equipamento_setor,
           e.tipo AS equipamento_tipo
    FROM preventiva_planos p
    LEFT JOIN equipamentos e ON e.id = p.equipamento_id
    WHERE p.id = ?
    LIMIT 1
  `).get(Number(id));
}

function listExecucoes(planoId) {
  return db.prepare(`
    SELECT *
    FROM preventiva_execucoes
    WHERE plano_id = ?
    ORDER BY
      CASE status
        WHEN 'atrasada' THEN 1
        WHEN 'pendente' THEN 2
        WHEN 'executada' THEN 3
        WHEN 'cancelada' THEN 4
        ELSE 9
      END,
      COALESCE(data_prevista,'9999-12-31') ASC,
      id DESC
  `).all(Number(planoId));
}

function createExecucao(planoId, data) {
  const stmt = db.prepare(`
    INSERT INTO preventiva_execucoes (
      plano_id, data_prevista, status, responsavel, observacao
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const r = stmt.run(
    Number(planoId),
    (data.data_prevista || "").trim() || null,
    String(data.status || "pendente").trim(),
    String(data.responsavel || "").trim(),
    String(data.observacao || "").trim()
  );

  return Number(r.lastInsertRowid);
}

function updateExecucaoStatus(planoId, execId, status, dataExecutada) {
  // só garante que pertence ao plano
  const exec = db.prepare(`
    SELECT id FROM preventiva_execucoes
    WHERE id = ? AND plano_id = ?
  `).get(Number(execId), Number(planoId));

  if (!exec) return false;

  const st = String(status || "").trim();

  const stmt = db.prepare(`
    UPDATE preventiva_execucoes
    SET status = ?,
        data_executada = ?
    WHERE id = ? AND plano_id = ?
  `);

  stmt.run(
    st,
    (dataExecutada || "").trim() || null,
    Number(execId),
    Number(planoId)
  );

  return true;
}

module.exports = {
  listPlanos,
  listEquipamentosAtivos,
  createPlano,
  getPlanoById,
  listExecucoes,
  createExecucao,
  updateExecucaoStatus
};
