// modules/equipamentos/equipamentos.service.js
const db = require("../../database/db");

function list() {
  return db
    .prepare(
      `SELECT id, codigo, nome, setor, tipo, criticidade, ativo, created_at, updated_at
       FROM equipamentos
       ORDER BY nome ASC
       LIMIT 500`
    )
    .all();
}

function getById(id) {
  return db
    .prepare(
      `SELECT id, codigo, nome, setor, tipo, criticidade, ativo, created_at, updated_at
       FROM equipamentos
       WHERE id = ?`
    )
    .get(id);
}

function create({ codigo, nome, setor, tipo, criticidade, ativo }) {
  const stmt = db.prepare(
    `INSERT INTO equipamentos (codigo, nome, setor, tipo, criticidade, ativo)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const info = stmt.run(
    codigo,
    nome,
    setor,
    tipo,
    criticidade || "media",
    ativo ? 1 : 0
  );
  return info.lastInsertRowid;
}

function update(id, { codigo, nome, setor, tipo, criticidade, ativo }) {
  db.prepare(
    `UPDATE equipamentos
     SET codigo = ?,
         nome = ?,
         setor = ?,
         tipo = ?,
         criticidade = ?,
         ativo = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    codigo,
    nome,
    setor,
    tipo,
    criticidade || "media",
    ativo ? 1 : 0,
    id
  );
}

module.exports = { list, getById, create, update };
