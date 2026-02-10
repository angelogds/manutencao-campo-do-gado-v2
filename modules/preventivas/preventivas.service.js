// modules/preventivas/preventivas.service.js
const db = require("../../database/db");

// Equipamentos ativos (para dropdown)
function listEquipamentosAtivos() {
  return db
    .prepare(
      `SELECT id, codigo, nome, setor
       FROM equipamentos
       WHERE ativo = 1
       ORDER BY setor ASC, nome ASC`
    )
    .all();
}

// Planos
function listPlanos({ ativo } = {}) {
  if (ativo === "1" || ativo === "0") {
    return db
      .prepare(
        `SELECT p.*, e.nome AS equipamento_nome, e.codigo AS equipamento_codigo
         FROM preventiva_planos p
         LEFT JOIN equipamentos e ON e.id = p.equipamento_id
         WHERE p.ativo = ?
         ORDER BY p.id DESC`
      )
      .all(Number(ativo));
  }

  return db
    .prepare(
      `SELECT p.*, e.nome AS equipamento_nome, e.codigo AS equipamento_codigo
       FROM preventiva_planos p
       LEFT JOIN equipamentos e ON e.id = p.equipamento_id
       ORDER BY p.id DESC`
    )
    .all();
}

function createPlano({ equipamento_id, titulo, frequencia_tipo, frequencia_valor, observacao }) {
  const r = db
    .prepare(
      `INSERT INTO preventiva_planos
       (equipamento_id, titulo, frequencia_tipo, frequencia_valor, observacao)
       VALUES (@equipamento_id, @titulo, @frequencia_tipo, @frequencia_valor, @observacao)`
    )
    .run({
      equipamento_id: equipamento_id || null,
      titulo,
      frequencia_tipo,
      frequencia_valor: Number.isFinite(frequencia_valor) ? frequencia_valor : 1,
      observacao: observacao || null,
    });

  return Number(r.lastInsertRowid);
}

function getPlanoById(id) {
  const plano = db
    .prepare(
      `SELECT p.*, e.nome AS equipamento_nome, e.codigo AS equipamento_codigo, e.setor AS equipamento_setor
       FROM preventiva_planos p
       LEFT JOIN equipamentos e ON e.id = p.equipamento_id
       WHERE p.id = ?`
    )
    .get(id);

  if (!plano) return null;

  const execucoes = db
    .prepare(
      `SELECT *
       FROM preventiva_execucoes
       WHERE plano_id = ?
       ORDER BY id DESC`
    )
    .all(id);

  return { ...plano, execucoes };
}

function togglePlanoAtivo(id) {
  db.prepare(
    `UPDATE preventiva_planos
     SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END
     WHERE id = ?`
  ).run(id);
}

// Execuções
function createExecucao({ plano_id, data_prevista, responsavel, observacao }) {
  db.prepare(
    `INSERT INTO preventiva_execucoes
     (plano_id, data_prevista, status, responsavel, observacao)
     VALUES (@plano_id, @data_prevista, 'pendente', @responsavel, @observacao)`
  ).run({
    plano_id,
    data_prevista,
    responsavel,
    observacao,
  });
}

function updateExecucaoStatus(execId, { status, data_executada }) {
  // Se marcou executada e não informou data, usa hoje.
  let finalData = data_executada;
  if (status === "executada" && !finalData) {
    const d = new Date();
    finalData = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  db.prepare(
    `UPDATE preventiva_execucoes
     SET status = ?, data_executada = ?
     WHERE id = ?`
  ).run(status, finalData || null, execId);
}

function getPlanoIdByExecucao(execId) {
  const r = db.prepare(`SELECT plano_id FROM preventiva_execucoes WHERE id = ?`).get(execId);
  return r ? Number(r.plano_id) : null;
}

module.exports = {
  listEquipamentosAtivos,
  listPlanos,
  createPlano,
  getPlanoById,
  togglePlanoAtivo,
  createExecucao,
  updateExecucaoStatus,
  getPlanoIdByExecucao,
};
