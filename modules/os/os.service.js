// modules/os/os.service.js
const db = require("../../database/db");

// Lista equipamentos ativos
function listEquipamentosAtivos() {
  return db
    .prepare(
      `SELECT id, codigo, nome
       FROM equipamentos
       WHERE ativo = 1
       ORDER BY nome`
    )
    .all();
}

// Lista OS (últimas)
function listOS() {
  return db
    .prepare(
      `SELECT id, equipamento, descricao, tipo, status, opened_at
       FROM os
       ORDER BY id DESC
       LIMIT 200`
    )
    .all();
}

// Pega OS por id
function getOSById(id) {
  return db
    .prepare(
      `SELECT *
       FROM os
       WHERE id = ?`
    )
    .get(id);
}

// Cria OS
function createOS({ equipamento_id, equipamento_texto, descricao, tipo, opened_by }) {
  const desc = (descricao || "").trim();
  if (!desc) throw new Error("Descrição obrigatória.");

  // Define equipamento (texto final)
  let equipamentoFinal = (equipamento_texto || "").trim();
  let equipId = equipamento_id ? Number(equipamento_id) : null;

  if (equipId) {
    const eq = db.prepare(`SELECT nome FROM equipamentos WHERE id = ?`).get(equipId);
    if (eq?.nome) {
      equipamentoFinal = eq.nome;
    } else {
      // se id veio errado, ignora
      equipId = null;
    }
  }

  if (!equipamentoFinal) {
    throw new Error("Informe um equipamento (cadastro ou manual).");
  }

  const t = (tipo || "CORRETIVA").trim().toUpperCase();

  // Detecta se coluna equipamento_id existe
  const cols = db.prepare(`PRAGMA table_info(os)`).all().map(c => c.name);
  const hasEquipId = cols.includes("equipamento_id");

  let stmt;
  if (hasEquipId) {
    stmt = db.prepare(`
      INSERT INTO os (equipamento, equipamento_id, descricao, tipo, status, opened_by)
      VALUES (?, ?, ?, ?, 'ABERTA', ?)
    `);
    const info = stmt.run(equipamentoFinal, equipId, desc, t, opened_by || null);
    return info.lastInsertRowid;
  }

  // fallback antigo
  stmt = db.prepare(`
    INSERT INTO os (equipamento, descricao, tipo, status, opened_by)
    VALUES (?, ?, ?, 'ABERTA', ?)
  `);
  const info = stmt.run(equipamentoFinal, desc, t, opened_by || null);
  return info.lastInsertRowid;
}

// Atualiza status
function updateStatus(id, status, closed_by) {
  const st = (status || "").trim().toUpperCase();
  const allowed = ["ABERTA", "ANDAMENTO", "PAUSADA", "CONCLUIDA", "CANCELADA"];
  if (!allowed.includes(st)) throw new Error("Status inválido.");

  if (st === "CONCLUIDA" || st === "CANCELADA") {
    db.prepare(
      `UPDATE os
       SET status = ?, closed_by = ?, closed_at = datetime('now')
       WHERE id = ?`
    ).run(st, closed_by || null, id);
    return;
  }

  db.prepare(
    `UPDATE os
     SET status = ?
     WHERE id = ?`
  ).run(st, id);
}

module.exports = {
  listEquipamentosAtivos,
  listOS,
  getOSById,
  createOS,
  updateStatus,
};
