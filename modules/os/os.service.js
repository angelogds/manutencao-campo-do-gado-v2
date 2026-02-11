// modules/os/os.service.js
const db = require("../../database/db");

function listOS() {
  return db
    .prepare(`
      SELECT
        o.*,
        e.nome AS equipamento_nome
      FROM os o
      LEFT JOIN equipamentos e ON e.id = o.equipamento_id
      ORDER BY o.id DESC
    `)
    .all();
}

function getOSById(id) {
  const os = db
    .prepare(`
      SELECT
        o.*,
        e.nome AS equipamento_nome
      FROM os o
      LEFT JOIN equipamentos e ON e.id = o.equipamento_id
      WHERE o.id = ?
    `)
    .get(id);

  return os || null;
}

function listEquipamentosAtivos() {
  return db
    .prepare(`SELECT id, codigo, nome, setor FROM equipamentos WHERE ativo = 1 ORDER BY nome ASC`)
    .all();
}

function createOS(payload) {
  const {
    equipamento_id,
    equipamento_texto,
    descricao,
    tipo,
    opened_by,
  } = payload;

  // tenta pegar o nome do equipamento se veio id
  let equipamentoFinal = (equipamento_texto || "").trim();

  if (equipamento_id) {
    const e = db.prepare(`SELECT nome FROM equipamentos WHERE id = ?`).get(equipamento_id);
    if (e?.nome) equipamentoFinal = e.nome;
  }

  if (!equipamentoFinal) {
    throw new Error("Equipamento é obrigatório (selecione ou digite).");
  }

  const info = db
    .prepare(`
      INSERT INTO os (equipamento_id, equipamento, descricao, tipo, status, opened_by, opened_at)
      VALUES (?, ?, ?, ?, 'ABERTA', ?, datetime('now'))
    `)
    .run(
      equipamento_id || null,
      equipamentoFinal,
      (descricao || "").trim(),
      String(tipo || "CORRETIVA").trim().toUpperCase(),
      opened_by || null
    );

  return info.lastInsertRowid;
}

function updateStatus(id, status, closed_by) {
  const st = String(status || "").trim().toUpperCase();

  if (st === "CONCLUIDA") {
    db.prepare(
      `UPDATE os SET status = ?, closed_by = ?, closed_at = datetime('now') WHERE id = ?`
    ).run(st, closed_by || null, id);
    return;
  }

  db.prepare(`UPDATE os SET status = ? WHERE id = ?`).run(st, id);
}

module.exports = {
  listOS,
  getOSById,
  listEquipamentosAtivos,
  createOS,
  updateStatus,
};
