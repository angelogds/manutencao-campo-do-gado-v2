// modules/os/os.service.js
const db = require("../../database/db");

function listOS() {
  const stmt = db.prepare(`
    SELECT
      o.id,
      o.descricao,
      o.tipo,
      o.status,
      o.custo_total,
      o.opened_at,
      o.closed_at,
      o.opened_by,
      o.closed_by,
      o.equipamento_id,
      COALESCE(e.nome, o.equipamento) AS equipamento
    FROM os o
    LEFT JOIN equipamentos e ON e.id = o.equipamento_id
    ORDER BY o.id DESC
  `);
  return stmt.all();
}

function getOSById(id) {
  const stmt = db.prepare(`
    SELECT
      o.*,
      COALESCE(e.nome, o.equipamento) AS equipamento_nome
    FROM os o
    LEFT JOIN equipamentos e ON e.id = o.equipamento_id
    WHERE o.id = ?
  `);
  return stmt.get(id);
}

function createOS({ equipamento_id, equipamento_texto, descricao, tipo, opened_by }) {
  const insert = db.prepare(`
    INSERT INTO os (equipamento_id, equipamento, descricao, tipo, status, opened_by)
    VALUES (@equipamento_id, @equipamento, @descricao, @tipo, 'ABERTA', @opened_by)
  `);

  const info = insert.run({
    equipamento_id: equipamento_id || null,
    equipamento: (equipamento_texto || "").trim() || "(não informado)",
    descricao: (descricao || "").trim(),
    tipo: (tipo || "CORRETIVA").trim().toUpperCase(),
    opened_by: opened_by || null,
  });

  return info.lastInsertRowid;
}

function updateStatus(id, status, closed_by = null) {
  const st = String(status || "").trim().toUpperCase();

  if (st === "CONCLUIDA" || st === "CANCELADA") {
    const stmt = db.prepare(`
      UPDATE os
      SET status = ?, closed_at = datetime('now'), closed_by = ?
      WHERE id = ?
    `);
    stmt.run(st, closed_by, id);
    return;
  }

  const stmt = db.prepare(`UPDATE os SET status = ? WHERE id = ?`);
  stmt.run(st, id);
}

module.exports = {
  listOS,
  getOSById,
  createOS,
  updateStatus,
};
