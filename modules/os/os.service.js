const db = require("../../database/db");

// Lista OS (status opcional)
exports.listOS = ({ status } = {}) => {
  if (status && status !== "TODAS") {
    return db.prepare(`
      SELECT
        id, equipamento, tipo, status, custo_total, opened_by, opened_at, closed_at
      FROM os
      WHERE status = ?
      ORDER BY id DESC
    `).all(status);
  }

  return db.prepare(`
    SELECT
      id, equipamento, tipo, status, custo_total, opened_by, opened_at, closed_at
    FROM os
    ORDER BY id DESC
  `).all();
};

// Cria OS
exports.createOS = ({ equipamento, descricao, tipo = "CORRETIVA", opened_by }) => {
  const res = db.prepare(`
    INSERT INTO os (equipamento, descricao, tipo, status, custo_total, opened_by, opened_at)
    VALUES (?, ?, ?, 'ABERTA', 0, ?, datetime('now'))
  `).run(equipamento, descricao, tipo, opened_by);

  return res.lastInsertRowid;
};

// Busca por id
exports.getOSById = (id) => {
  return db.prepare(`
    SELECT
      id, equipamento, descricao, tipo, status, custo_total,
      opened_by, closed_by, opened_at, closed_at
    FROM os
    WHERE id = ?
  `).get(id);
};

// Atualiza status (ANDAMENTO / PAUSADA / CONCLUIDA / CANCELADA)
exports.updateStatus = ({ id, status }) => {
  return db.prepare(`
    UPDATE os
    SET status = ?
    WHERE id = ?
  `).run(status, id);
};

// Fecha OS (marca como CONCLUIDA e fecha data)
exports.closeOS = ({ id, closed_by, custo_total = 0 }) => {
  return db.prepare(`
    UPDATE os
    SET status = 'CONCLUIDA',
        closed_by = ?,
        custo_total = ?,
        closed_at = datetime('now')
    WHERE id = ?
  `).run(closed_by, custo_total, id);
};
