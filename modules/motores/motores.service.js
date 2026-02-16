const db = require("../../database/db");

function nowBRLite() {
  // mantém no padrão do projeto (datetime('now')) no banco; aqui só para payload
  return new Date().toISOString();
}

function addEvento(motorId, tipo, payloadObj) {
  const payload = payloadObj ? JSON.stringify(payloadObj) : null;
  db.prepare(
    `INSERT INTO motores_eventos (motor_id, tipo, payload, created_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).run(motorId, tipo, payload);
}

function create(data, userId) {
  const stmt = db.prepare(`
    INSERT INTO motores
    (codigo, descricao, potencia_cv, rpm, origem_unidade, local_instalacao, status, observacao, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const info = stmt.run(
    data.codigo,
    data.descricao,
    data.potencia_cv,
    data.rpm,
    data.origem_unidade,
    data.local_instalacao,
    data.status,
    data.observacao
  );

  const id = Number(info.lastInsertRowid);
  addEvento(id, "CADASTRO", { ...data, by_user_id: userId, at: nowBRLite() });
  return id;
}

function list({ q, origem, status, potencia }) {
  const where = [];
  const params = {};

  if (q) {
    where.push("(codigo LIKE @q OR descricao LIKE @q OR local_instalacao LIKE @q)");
    params.q = `%${q}%`;
  }
  if (origem) {
    where.push("origem_unidade = @origem");
    params.origem = origem;
  }
  if (status) {
    where.push("status = @status");
    params.status = status;
  }
  if (potencia) {
    // filtra por potência exata (simples)
    where.push("potencia_cv = @potencia");
    params.potencia = Number(potencia);
  }

  const sql = `
    SELECT *
    FROM motores
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY updated_at DESC, id DESC
    LIMIT 500
  `;

  return db.prepare(sql).all(params);
}

function getById(id) {
  return db.prepare(`SELECT * FROM motores WHERE id=?`).get(id);
}

function listEventos(motorId) {
  return db
    .prepare(`SELECT * FROM motores_eventos WHERE motor_id=? ORDER BY id DESC LIMIT 100`)
    .all(motorId)
    .map((e) => ({
      ...e,
      payloadObj: e.payload ? safeJsonParse(e.payload) : null,
    }));
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: s };
  }
}

function enviarRebob(id, { empresa_rebob, motorista_saida, observacao }, userId) {
  const motor = getById(id);
  if (!motor) throw new Error("Motor não encontrado");

  db.prepare(`
    UPDATE motores
    SET status='ENVIADO_REBOB',
        empresa_rebob=?,
        motorista_saida=?,
        data_saida=datetime('now'),
        observacao=COALESCE(?, observacao),
        updated_at=datetime('now')
    WHERE id=?
  `).run(empresa_rebob || null, motorista_saida || null, observacao, id);

  addEvento(id, "ENVIAR", { empresa_rebob, motorista_saida, observacao, by_user_id: userId, at: nowBRLite() });
}

function registrarRetorno(id, { motorista_retorno, observacao }, userId) {
  const motor = getById(id);
  if (!motor) throw new Error("Motor não encontrado");

  db.prepare(`
    UPDATE motores
    SET status='RETORNOU',
        motorista_retorno=?,
        data_retorno=datetime('now'),
        observacao=COALESCE(?, observacao),
        updated_at=datetime('now')
    WHERE id=?
  `).run(motorista_retorno || null, observacao, id);

  addEvento(id, "RETORNO", { motorista_retorno, observacao, by_user_id: userId, at: nowBRLite() });
}

module.exports = {
  list,
  create,
  getById,
  listEventos,
  enviarRebob,
  registrarRetorno,
};
