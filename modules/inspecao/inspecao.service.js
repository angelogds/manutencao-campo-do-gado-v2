const db = require("../../database/db");

/* =========================================================
   UTIL
========================================================= */

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
}

function normalizeText(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveInspectionTable() {
  return "inspecao_pac01";
}

function resolveNCTable() {
  return "inspecao_pac01_nao_conformidades";
}

/* =========================================================
   GET OR CREATE INSPECTION
========================================================= */

function getOrCreateInspection(mes, ano, userId) {
  const table = resolveInspectionTable();

  let row = db.prepare(
    `SELECT * FROM ${table} WHERE mes = ? AND ano = ?`
  ).get(mes, ano);

  if (row) return row;

  const insert = db.prepare(
    `INSERT INTO ${table}
     (mes, ano, frequencia, monitor_nome, verificador_nome, created_by)
     VALUES (?, ?, 'Diária', '', '', ?)`
  );

  const info = insert.run(mes, ano, userId);

  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`)
           .get(info.lastInsertRowid);
}

/* =========================================================
   REGRA NC
========================================================= */

function isNC(osRow) {
  if (!osRow) return false;

  if (Number(osRow.nao_conforme || 0) === 1) return true;

  const tipo = normalizeText(osRow.tipo);
  const texto = String(osRow.texto_problema || "").trim();

  // REGRA PRINCIPAL: OS corretiva com descrição => NC
  if (tipo.includes("corretiva") && texto.length > 0) return true;

  const status = normalizeText(osRow.status);
  if (status.includes("quebra") || status.includes("parada")) return true;

  const hay = normalizeText(`${texto} ${osRow.causa_diagnostico || ""}`);
  const KEYWORDS = ["rolamento", "correia", "bomba", "motor", "vazamento"];
  return KEYWORDS.some(k => hay.includes(k));
}

/* =========================================================
   LISTAR NÃO CONFORMIDADES
========================================================= */

function listNC(inspecaoId) {
  const ncTable = resolveNCTable();

  const sql = `
    SELECT
      nc.id,
      nc.inspecao_id,
      nc.equipamento_id,
      nc.data_ocorrencia,
      nc.nao_conformidade,
      nc.acao_corretiva,
      nc.acao_preventiva,
      nc.data_correcao,
      nc.os_id,
      e.nome   AS equipamento_nome,
      e.codigo AS equipamento_codigo
    FROM ${ncTable} nc
    LEFT JOIN equipamentos e ON e.id = nc.equipamento_id
    WHERE nc.inspecao_id = ?
    ORDER BY date(nc.data_ocorrencia) DESC
  `;

  return db.prepare(sql).all(inspecaoId).map(row => ({
    ...row,
    item: row.equipamento_codigo || row.equipamento_nome || "-"
  }));
}

/* =========================================================
   SINCRONIZAR OS FECHADA
========================================================= */

function syncFromClosedOS(osId) {
  const os = db.prepare(`
    SELECT *
    FROM ordens_servico
    WHERE id = ?
  `).get(osId);

  if (!os) return;

  if (os.status !== "FECHADA") return;

  if (!isNC(os)) return;

  const data = new Date(os.data_inicio);
  const mes = data.getMonth() + 1;
  const ano = data.getFullYear();

  const inspection = getOrCreateInspection(mes, ano, os.created_by);

  const ncTable = resolveNCTable();

  db.prepare(`
    INSERT INTO ${ncTable}
    (inspecao_id, equipamento_id, data_ocorrencia,
     nao_conformidade, acao_corretiva, acao_preventiva,
     data_correcao, os_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inspection.id,
    os.equipamento_id,
    os.data_inicio,
    os.texto_problema,
    os.resumo_tecnico,
    os.causa_diagnostico,
    os.data_fim,
    os.id
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getOrCreateInspection,
  listNC,
  syncFromClosedOS
};
