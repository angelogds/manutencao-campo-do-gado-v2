const db = require("../../database/db");

function listEquipamentos() {
  try {
    return db.prepare("SELECT id, nome FROM equipamentos WHERE ativo=1 ORDER BY nome").all();
  } catch (_e) {
    return [];
  }
}

function listPlanos() {
  try {
    return db.prepare(`
      SELECT p.*, e.nome AS equipamento_nome
      FROM preventiva_planos p
      LEFT JOIN equipamentos e ON e.id = p.equipamento_id
      ORDER BY p.id DESC
    `).all();
  } catch (_e) {
    return [];
  }
}

function createPlano(data) {
  const stmt = db.prepare(`
    INSERT INTO preventiva_planos (equipamento_id, titulo, frequencia_tipo, frequencia_valor, observacao)
    VALUES (?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.equipamento_id,
    data.titulo,
    data.frequencia_tipo,
    data.frequencia_valor,
    data.observacao
  );

  return info.lastInsertRowid;
}

function getPlanoById(id) {
  try {
    return db.prepare(`
      SELECT p.*, e.nome AS equipamento_nome
      FROM preventiva_planos p
      LEFT JOIN equipamentos e ON e.id = p.equipamento_id
      WHERE p.id = ?
    `).get(id);
  } catch (_e) {
    return null;
  }
}

module.exports = { listEquipamentos, listPlanos, createPlano, getPlanoById };
