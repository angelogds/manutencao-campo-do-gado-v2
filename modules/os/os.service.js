const db = require("../../database/db");

exports.listOS = ({ status }) => {
  return db
    .prepare(
      `
    SELECT
      id, equipamento, tipo, status, opened_at
    FROM os
    WHERE status = ?
    ORDER BY id DESC
  `
    )
    .all(status);
};

exports.createOS = ({ equipamento, descricao, tipo, opened_by }) => {
  const res = db
    .prepare(
      `
    INSERT INTO os (equipamento, descricao, tipo, status, opened_by, opened_at)
    VALUES (?, ?, ?, 'ABERTA', ?, datetime('now'))
  `
    )
    .run(equipamento, descricao, tipo || "CORRETIVA", opened_by);

  return res.lastInsertRowid;
};

exports.getOSById = (id) => {
  return db
    .prepare(
      `
    SELECT
      id, equipamento, descricao, tipo, status, opened_by, opened_at, closed_by, closed_at, custo_total
    FROM os
    WHERE id = ?
  `
    )
    .get(id);
};

exports.updateStatus = ({ id, status, closed_by }) => {
  // Se concluir/cancelar -> fecha
  if (["CONCLUIDA", "CANCELADA"].includes(status)) {
    db.prepare(
      `UPDATE os SET status=?, closed_by=?, closed_at=datetime('now') WHERE id=?`
    ).run(status, closed_by, id);
  } else {
    db.prepare(`UPDATE os SET status=? WHERE id=?`).run(status, id);
  }
};
