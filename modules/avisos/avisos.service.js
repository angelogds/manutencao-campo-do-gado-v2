const db = require("../../database/db");

function listAvisos(limit = 100) {
  return db
    .prepare(`
      SELECT a.id, a.titulo, a.mensagem, a.created_at,
             COALESCE(u.name, 'Sistema') AS autor_nome
      FROM avisos a
      LEFT JOIN users u ON u.id = a.created_by
      ORDER BY a.id DESC
      LIMIT ?
    `)
    .all(Number(limit) || 100);
}

function createAviso({ titulo, mensagem, createdBy }) {
  const info = db
    .prepare(`
      INSERT INTO avisos (titulo, mensagem, created_by, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `)
    .run(String(titulo || '').trim(), String(mensagem || '').trim(), createdBy || null);

  return Number(info.lastInsertRowid);
}

module.exports = {
  listAvisos,
  createAviso,
};
