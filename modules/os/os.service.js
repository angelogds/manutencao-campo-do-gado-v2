// modules/os/os.service.js
const db = require("../../database/db");

function listOS({ status = null } = {}) {
  if (status) {
    return db
      .prepare(
        `SELECT id, equipamento, descricao, tipo, status, custo_total, opened_at, closed_at
         FROM os
         WHERE status = ?
         ORDER BY id DESC`
      )
      .all(status);
  }

  return db
    .prepare(
      `SELECT id, equipamento, descricao, tipo, status, custo_total, opened_at, closed_at
       FROM os
       ORDER BY id DESC`
    )
    .all();
}

function getBlocks() {
  const abertas = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM os
       WHERE status IN ('ABERTA','ANDAMENTO','PAUSADA')`
    )
    .get()?.total || 0;

  const acompanhar = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM os
       WHERE status IN ('ANDAMENTO','PAUSADA')`
    )
    .get()?.total || 0;

  const finalizadas = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM os
       WHERE status IN ('CONCLUIDA','CANCELADA')`
    )
    .get()?.total || 0;

  return {
    os: { abertas, acompanhar, finalizadas },
  };
}

function createOS({ equipamento, descricao, tipo, opened_by }) {
  const stmt = db.prepare(
    `INSERT INTO os (equipamento, descricao, tipo, status, opened_by)
     VALUES (?, ?, ?, 'ABERTA', ?)`
  );
  const info = stmt.run(equipamento, descricao, tipo, opened_by);
  return info.lastInsertRowid;
}

function getOSById(id) {
  const os = db
    .prepare(
      `SELECT id, equipamento, descricao, tipo, status, custo_total, opened_by, closed_by, opened_at, closed_at
       FROM os
       WHERE id = ?`
    )
    .get(id);

  return os || null;
}

function updateOSStatus(id, status, { userId } = {}) {
  // status válidos
  const allowed = new Set(["ABERTA", "ANDAMENTO", "PAUSADA", "CONCLUIDA", "CANCELADA"]);
  if (!allowed.has(status)) return false;

  // Se concluir/cancelar, seta closed_at e closed_by
  if (status === "CONCLUIDA" || status === "CANCELADA") {
    const info = db
      .prepare(
        `UPDATE os
         SET status = ?, closed_at = datetime('now'), closed_by = ?
         WHERE id = ?`
      )
      .run(status, userId || null, id);
    return info.changes > 0;
  }

  // Reabrir / andamento / pausada
  const info = db
    .prepare(
      `UPDATE os
       SET status = ?, closed_at = NULL, closed_by = NULL
       WHERE id = ?`
    )
    .run(status, id);

  return info.changes > 0;
}

module.exports = {
  listOS,
  getBlocks,
  createOS,
  getOSById,
  updateOSStatus,
};
