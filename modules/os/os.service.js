const db = require("../../database/db");

exports.listOS = ({ status }) => {
  return db.prepare(`
    SELECT
      id, titulo, setor, prioridade, status, created_at
    FROM os
    WHERE status = ?
    ORDER BY id DESC
  `).all(status);
};

exports.createOS = ({ titulo, setor, descricao, prioridade, created_by }) => {
  const res = db.prepare(`
    INSERT INTO os (titulo, setor, descricao, prioridade, status, created_by, created_at)
    VALUES (?, ?, ?, ?, 'ABERTA', ?, datetime('now'))
  `).run(titulo, setor, descricao, prioridade, created_by);

  return res.lastInsertRowid;
};

exports.getOSById = (id) => {
  return db.prepare(`
    SELECT
      id, titulo, setor, descricao, prioridade, status, created_by, created_at
    FROM os
    WHERE id = ?
  `).get(id);
};
