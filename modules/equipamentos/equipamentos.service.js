// modules/equipamentos/equipamentos.service.js
const db = require("../../database/db");

function list() {
  return db
    .prepare(
      `
      SELECT id, codigo, nome, setor, tipo, criticidade, ativo, created_at, updated_at
      FROM equipamentos
      ORDER BY ativo DESC, nome ASC
    `
    )
    .all();
}

function getById(id) {
  return db
    .prepare(
      `
      SELECT id, codigo, nome, setor, tipo, criticidade, ativo, created_at, updated_at
      FROM equipamentos
      WHERE id = ?
    `
    )
    .get(id);
}

function create(data) {
  const stmt = db.prepare(`
    INSERT INTO equipamentos (codigo, nome, setor, tipo, criticidade, ativo, created_at, updated_at)
    VALUES (@codigo, @nome, @setor, @tipo, @criticidade, @ativo, datetime('now'), datetime('now'))
  `);

  const info = stmt.run({
    codigo: (data.codigo || "").trim() || null,
    nome: (data.nome || "").trim(),
    setor: (data.setor || "").trim() || null,
    tipo: (data.tipo || "").trim() || null,
    criticidade: (data.criticidade || "media").trim(),
    ativo: data.ativo ? 1 : 0,
  });

  return info.lastInsertRowid;
}

function update(id, data) {
  const stmt = db.prepare(`
    UPDATE equipamentos
    SET
      codigo = @codigo,
      nome = @nome,
      setor = @setor,
      tipo = @tipo,
      criticidade = @criticidade,
      ativo = @ativo,
      updated_at = datetime('now')
    WHERE id = @id
  `);

  stmt.run({
    id,
    codigo: (data.codigo || "").trim() || null,
    nome: (data.nome || "").trim(),
    setor: (data.setor || "").trim() || null,
    tipo: (data.tipo || "").trim() || null,
    criticidade: (data.criticidade || "media").trim(),
    ativo: data.ativo ? 1 : 0,
  });
}

module.exports = {
  list,
  getById,
  create,
  update,
};
