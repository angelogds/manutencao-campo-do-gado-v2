const db = require("../../database/db");

exports.listAll = () => {
  return db
    .prepare(
      `
      SELECT 
        id,
        nome,
        setor,
        codigo,
        created_at
      FROM equipamentos
      ORDER BY id DESC
    `
    )
    .all();
};

exports.create = ({ nome, setor, codigo, created_by }) => {
  const stmt = db.prepare(`
    INSERT INTO equipamentos (nome, setor, codigo, created_by, created_at)
    VALUES (?, ?, ?, ?, datetime('now','-3 hours'))
  `);

  const info = stmt.run(nome, setor, codigo || null, created_by || null);
  return info.lastInsertRowid;
};
