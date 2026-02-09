// modules/os/os.service.js
const db = require("../../database/db");

function list() {
  return db
    .prepare(
      `SELECT
         id,
         equipamento,
         descricao,
         tipo,
         status,
         custo_total,
         opened_by,
         closed_by,
         opened_at,
         closed_at
       FROM os
       ORDER BY id DESC
       LIMIT 200`
    )
    .all();
}

function getById(id) {
  return db
    .prepare(
      `SELECT
         id,
         equipamento,
         descricao,
         tipo,
         status,
         custo_total,
         opened_by,
         closed_by,
         opened_at,
         closed_at
       FROM os
       WHERE id = ?`
    )
    .get(id);
}

function create({ equipamento, descricao, tipo, opened_by }) {
  const stmt = db.prepare(
    `INSERT INTO os (equipamento, descricao, tipo, opened_by)
     VALUES (?, ?, ?, ?)`
  );
  const info = stmt.run(equipamento, descricao, tipo || "CORRETIVA", opened_by);
  return info.lastInsertRowid;
}

function updateStatus(id, status, closed_by) {
  const st = String(status).toUpperCase();

  // Se status final, fecha
  const isFinal = st === "CONCLUIDA" || st === "CANCELADA";

  if (isFinal) {
    db.prepare(
      `UPDATE os
       SET status = ?,
           closed_by = ?,
           closed_at = datetime('now')
       WHERE id = ?`
    ).run(st, closed_by, id);
  } else {
    db.prepare(`UPDATE os SET status = ? WHERE id = ?`).run(st, id);
  }
}

module.exports = { list, getById, create, updateStatus };
