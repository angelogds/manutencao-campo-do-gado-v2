const db = require("../../database/db");

const STATUS_PRIORITY = { C: 0, SP: 1, EA: 2, NC: 3 };
const KEYWORDS = ["rolamento", "correia", "bomba", "motor", "vazamento"];

function tableExists(name) {
  try {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  } catch (_e) {
    return false;
  }
}

function tableColumns(table) {
  try {
    if (!tableExists(table)) return [];
    return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  } catch (_e) {
    return [];
  }
}

function logSchemaAudit() {
  console.log("[INSPECAO][OS_SOURCE] schema", {
    os: tableColumns("os"),
    ordens_servico: tableColumns("ordens_servico"),
    equipamentos: tableColumns("equipamentos"),
  });
}

function normalizeText(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeStatus(v) {
  const raw = normalizeText(v);
  if (raw.includes("finaliz") || raw.includes("fechad") || raw.includes("conclu")) return "FECHADA";
  if (raw.includes("andamento") || raw.includes("em_andamento")) return "EM_ANDAMENTO";
  if (raw.includes("aberta")) return "ABERTA";
  return String(v || "").toUpperCase();
}

function normalizeDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const iso = str.includes("T") ? str : str.replace(" ", "T");
  const dt = new Date(iso);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function parseDate(value) {
  const date = normalizeDate(value);
  if (!date) return null;
  return new Date(`${date}T00:00:00`);
}

function formatDate(value) {
  return normalizeDate(value) || "";
}

function resolveInspectionTable() {
  return "inspecoes_pac01";
}

function resolveGradeTable() {
  return tableExists("inspecao_pac01_grade") ? "inspecao_pac01_grade" : "inspecao_pac01_itens";
}

function resolveNCTable() {
  if (tableExists("inspecao_pac01_nao_conformidades")) return "inspecao_pac01_nao_conformidades";
  return "inspecao_pac01_nc";
}

function resolveOSTable() {
  // Source of truth: módulo OS lista/atualiza na tabela "os"
  if (tableExists("os")) return "os";
  if (tableExists("ordens_servico")) return "ordens_servico";
  return "os";
}

function getColumnValue(row, options = []) {
  for (const key of options) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function daysInMonth(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

function getMonthRange(ano, mes) {
  const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const nextMonth = mes === 12 ? 1 : mes + 1;
  const nextYear = mes === 12 ? ano + 1 : ano;
  const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, endExclusive };
}

function getOrCreateInspecao(mes, ano, userId) {
  const table = resolveInspectionTable();
  const createdByColumn = tableColumns(table).includes("created_by") ? "created_by" : "criado_por";

  let row = db.prepare(`SELECT * FROM ${table} WHERE mes = ? AND ano = ?`).get(mes, ano);
  if (row) return row;

  const info = db
    .prepare(
      `INSERT INTO ${table} (mes, ano, frequencia, monitor_nome, verificador_nome, ${createdByColumn})
       VALUES (?, ?, 'Diária', '', '', ?)`
    )
    .run(mes, ano, userId || null);

  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
}

function getOrCreateInspection(mes, ano, userId) {
  return getOrCreateInspecao(mes, ano, userId);
}

function listEquipamentosAtivos() {
  const eqCols = tableColumns("equipamentos");
  const itemExpr = eqCols.includes("codigo") ? "COALESCE(codigo, nome)" : "nome";
  return db
    .prepare(
      `SELECT id, nome, ${itemExpr} AS item, COALESCE(ativo, 1) AS ativo, COALESCE(codigo, '') AS codigo
       FROM equipamentos
       ORDER BY nome`
    )
    .all();
}

function mapOSRowsToEquipamento(osRows, equipamentos) {
  const byId = new Map(equipamentos.map((e) => [Number(e.id), e]));
  const byNome = new Map(equipamentos.map((e) => [normalizeText(e.nome), e]));
  const byCodigo = new Map(
    equipamentos
      .filter((e) => String(e.codigo || "").trim())
      .map((e) => [normalizeText(e.codigo), e])
  );

  return osRows.map((os) => {
    const eqId = Number(os.equipamento_id || 0);
    let match = byId.get(eqId) || null;
    const osEquipText = String(os.equipamento || os.equipamento_nome || os.equipamento_manual || "").trim();
    if (!match && osEquipText) {
      const norm = normalizeText(osEquipText);
      match = byNome.get(norm) || byCodigo.get(norm) || null;
    }

    console.log("[INSPECAO][MATCH]", {
      osId: os.id,
      equipamento_id: os.equipamento_id || null,
      equipamento_texto: osEquipText || null,
      match_equipamento_id: match?.id || null,
      match_equipamento_nome: match?.nome || null,
      dia: formatDate(os.data_inicio),
    });

    return {
      ...os,
      mapped_equipamento_id: match?.id || null,
      mapped_equipamento_nome: match?.nome || osEquipText || null,
    };
  });
}

function getOSByMonth(mes, ano) {
  const osTable = resolveOSTable();
  const cols = tableColumns(osTable);
  const { start, endExclusive } = getMonthRange(ano, mes);

  const dataCol = cols.includes("data_inicio")
    ? "data_inicio"
    : (cols.includes("opened_at") ? "opened_at" : (cols.includes("created_at") ? "created_at" : null));

  if (!dataCol) {
    console.warn("[INSPECAO][OS_SOURCE] sem coluna de data suportada", { osTable, cols });
    return [];
  }

  console.log("[INSPECAO][OS_SOURCE]", { osTable, dataCol, cols });

  const statusExpr = cols.includes("status") ? "status" : "'' AS status";
  const tipoExpr = cols.includes("tipo") ? "tipo" : "'' AS tipo";
  const equipIdExpr = cols.includes("equipamento_id") ? "equipamento_id" : "NULL AS equipamento_id";
  const equipExpr = cols.includes("equipamento") ? "equipamento" : "NULL AS equipamento";
  const equipNomeExpr = cols.includes("equipamento_nome") ? "equipamento_nome" : "NULL AS equipamento_nome";
  const equipManualExpr = cols.includes("equipamento_manual") ? "equipamento_manual" : "NULL AS equipamento_manual";

  const rows = db
    .prepare(
      `SELECT
        id,
        ${equipIdExpr},
        ${equipExpr},
        ${equipNomeExpr},
        ${equipManualExpr},
        ${dataCol} AS data_inicio,
        ${cols.includes("data_fim") ? "data_fim" : (cols.includes("data_conclusao") ? "data_conclusao" : (cols.includes("closed_at") ? "closed_at" : "NULL"))} AS data_fim,
        ${statusExpr},
        ${tipoExpr},
        ${cols.includes("descricao") ? "descricao" : "'' AS descricao"},
        ${cols.includes("descricao_problema") ? "descricao_problema" : "NULL AS descricao_problema"},
        ${cols.includes("solicitacao") ? "solicitacao" : "NULL AS solicitacao"},
        ${cols.includes("relato") ? "relato" : "NULL AS relato"},
        ${cols.includes("texto_problema") ? "texto_problema" : "NULL AS texto_problema"},
        ${cols.includes("resumo_tecnico") ? "resumo_tecnico" : (cols.includes("execucao") ? "execucao" : (cols.includes("servico_realizado") ? "servico_realizado" : "NULL"))} AS acao_corretiva,
        ${cols.includes("causa_diagnostico") ? "causa_diagnostico" : (cols.includes("causa") ? "causa" : (cols.includes("diagnostico") ? "diagnostico" : "NULL"))} AS acao_preventiva,
        ${cols.includes("nao_conforme") ? "nao_conforme" : "0 AS nao_conforme"}
      FROM ${osTable}
      WHERE date(${dataCol}) >= date(?) AND date(${dataCol}) < date(?)`
    )
    .all(start, endExclusive)
    .map((row) => ({ ...row, status_normalized: normalizeStatus(row.status) }));

  console.log("[INSPECAO][OS_MONTH]", { mes, ano, start, endExclusive, total: rows.length });
  return rows;
}

function updateHeader(inspecaoId, data = {}) {
  db.prepare(
    `UPDATE ${resolveInspectionTable()}
     SET monitor_nome = COALESCE(?, monitor_nome),
         verificador_nome = COALESCE(?, verificador_nome),
         frequencia = COALESCE(?, frequencia),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(data.monitor_nome || "").trim() || null,
    String(data.verificador_nome || "").trim() || null,
    String(data.frequencia || "").trim() || null,
    inspecaoId
  );
}

function isNC(osRow) {
  if (!osRow) return false;
  if (Number(getColumnValue(osRow, ["nao_conforme"])) === 1) return true;

  const tipo = normalizeText(getColumnValue(osRow, ["tipo"]));
  const ncText = String(
    getColumnValue(osRow, ["descricao_problema", "descricao", "solicitacao", "relato", "texto_problema"]) || ""
  ).trim();

  if (tipo.includes("corretiva") && ncText) return true;

  const fallback = normalizeText(`${ncText} ${getColumnValue(osRow, ["causa_diagnostico", "causa", "diagnostico"]) || ""}`);
  return KEYWORDS.some((k) => fallback.includes(k));
}

function statusValue(current, next) {
  return STATUS_PRIORITY[next] > STATUS_PRIORITY[current] ? next : current;
}

function ensureGradeRows(inspecaoId, ano, mes, equipamentos) {
  const gradeTable = resolveGradeTable();
  const dias = daysInMonth(ano, mes);
  const usesEquipamentoNome = tableColumns(gradeTable).includes("equipamento_nome");

  const insert = usesEquipamentoNome
    ? db.prepare(
        `INSERT OR IGNORE INTO ${gradeTable}
         (inspecao_id, equipamento_id, equipamento_nome, dia, status, os_id, observacao, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, datetime('now'))`
      )
    : db.prepare(
        `INSERT OR IGNORE INTO ${gradeTable}
         (inspecao_id, equipamento_id, dia, status, os_id, observacao, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, datetime('now'))`
      );

  for (const eq of equipamentos) {
    const baseStatus = Number(eq.ativo || 0) === 1 ? "C" : "SP";
    for (let dia = 1; dia <= dias; dia += 1) {
      if (usesEquipamentoNome) insert.run(inspecaoId, eq.id, eq.nome, dia, baseStatus);
      else insert.run(inspecaoId, eq.id, dia, baseStatus);
    }
  }
}

function recalculate(inspecaoId, mes, ano) {
  logSchemaAudit();
  console.log("[INSPECAO_RECALC] Início", { inspecaoId, mes, ano });

  const gradeTable = resolveGradeTable();
  const ncTable = resolveNCTable();
  const equipamentos = listEquipamentosAtivos();
  const dias = daysInMonth(ano, mes);

  ensureGradeRows(inspecaoId, ano, mes, equipamentos);

  const baseStatusByEq = new Map(equipamentos.map((eq) => [eq.id, Number(eq.ativo || 0) === 1 ? "C" : "SP"]));
  const osRowsMapped = mapOSRowsToEquipamento(getOSByMonth(mes, ano), equipamentos);

  const tx = db.transaction(() => {
    const reset = db.prepare(
      `UPDATE ${gradeTable}
       SET status = ?, os_id = NULL, updated_at = datetime('now')
       WHERE inspecao_id = ? AND equipamento_id = ? AND dia BETWEEN 1 AND ?`
    );

    for (const eq of equipamentos) reset.run(baseStatusByEq.get(eq.id) || "C", inspecaoId, eq.id, dias);

    db.prepare(`DELETE FROM ${ncTable} WHERE inspecao_id = ?`).run(inspecaoId);

    const gradeByEq = new Map(
      equipamentos.map((eq) => [eq.id, Array.from({ length: dias }, () => baseStatusByEq.get(eq.id))])
    );
    const ncRows = [];

    for (const os of osRowsMapped) {
      const start = parseDate(os.data_inicio);
      if (!start) continue;
      const eqId = Number(os.mapped_equipamento_id || 0);
      const grid = gradeByEq.get(eqId);
      if (!grid) continue;

      if (isNC(os)) {
        const startDay = start.getDate();
        if (startDay >= 1 && startDay <= dias) {
          grid[startDay - 1] = statusValue(grid[startDay - 1], "NC");
        }

        const endRaw = parseDate(os.data_fim);
        const isClosed = normalizeStatus(os.status) === "FECHADA";
        const end = endRaw || (isClosed ? start : null);
        const endDay = end ? Math.min(dias, end.getDate()) : dias;

        for (let day = startDay + 1; day <= endDay; day += 1) {
          grid[day - 1] = statusValue(grid[day - 1], "EA");
        }

        ncRows.push({
          equipamento_id: eqId,
          data_ocorrencia: formatDate(os.data_inicio),
          nao_conformidade: String(
            getColumnValue(os, ["descricao_problema", "descricao", "solicitacao", "relato", "texto_problema"]) || ""
          ).trim(),
          acao_corretiva: String(os.acao_corretiva || "").trim() || null,
          acao_preventiva: String(os.acao_preventiva || "").trim() || null,
          data_correcao: formatDate(os.data_fim) || null,
          os_id: os.id,
        });
      }
    }

    const upsertGrade = db.prepare(
      `INSERT INTO ${gradeTable} (inspecao_id, equipamento_id, dia, status, os_id, observacao, updated_at)
       VALUES (?, ?, ?, ?, NULL, NULL, datetime('now'))
       ON CONFLICT(inspecao_id, equipamento_id, dia)
       DO UPDATE SET status = excluded.status, os_id = excluded.os_id, updated_at = datetime('now')`
    );

    for (const [eqId, row] of gradeByEq.entries()) {
      for (let day = 1; day <= dias; day += 1) upsertGrade.run(inspecaoId, eqId, day, row[day - 1]);
    }

    const ncCols = tableColumns(ncTable);
    const hasEquipNome = ncCols.includes("equipamento_nome");
    const upsertNc = hasEquipNome
      ? db.prepare(
          `INSERT INTO ${ncTable}
           (inspecao_id, equipamento_id, equipamento_nome, data_ocorrencia, nao_conformidade, acao_corretiva, acao_preventiva, data_correcao, os_id, updated_at)
           VALUES (?, ?, (SELECT nome FROM equipamentos WHERE id = ?), ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(inspecao_id, equipamento_id, data_ocorrencia, os_id)
           DO UPDATE SET
             nao_conformidade = excluded.nao_conformidade,
             acao_corretiva = excluded.acao_corretiva,
             acao_preventiva = excluded.acao_preventiva,
             data_correcao = excluded.data_correcao,
             updated_at = datetime('now')`
        )
      : db.prepare(
          `INSERT INTO ${ncTable}
           (inspecao_id, equipamento_id, data_ocorrencia, nao_conformidade, acao_corretiva, acao_preventiva, data_correcao, os_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(inspecao_id, equipamento_id, data_ocorrencia, os_id)
           DO UPDATE SET
             nao_conformidade = excluded.nao_conformidade,
             acao_corretiva = excluded.acao_corretiva,
             acao_preventiva = excluded.acao_preventiva,
             data_correcao = excluded.data_correcao,
             updated_at = datetime('now')`
        );

    let ncUpserts = 0;
    for (const nc of ncRows) {
      const info = hasEquipNome
        ? upsertNc.run(
            inspecaoId,
            nc.equipamento_id,
            nc.equipamento_id,
            nc.data_ocorrencia,
            nc.nao_conformidade,
            nc.acao_corretiva,
            nc.acao_preventiva,
            nc.data_correcao,
            nc.os_id
          )
        : upsertNc.run(
            inspecaoId,
            nc.equipamento_id,
            nc.data_ocorrencia,
            nc.nao_conformidade,
            nc.acao_corretiva,
            nc.acao_preventiva,
            nc.data_correcao,
            nc.os_id
          );
      ncUpserts += Number(info?.changes || 0);
    }

    console.log("[INSPECAO][NC]", { inspecaoId, geradas: ncRows.length, upserts: ncUpserts });
    return { osCount: osRowsMapped.length, ncCount: ncRows.length, ncUpserts };
  });

  const result = tx();
  console.log("[INSPECAO_RECALC] Fim", { inspecaoId, mes, ano, ...result });
  return result;
}

function buildMatrix(inspecaoId, ano, mes, equipamentos = []) {
  const dias = daysInMonth(ano, mes);
  const gradeTable = resolveGradeTable();
  const rows = db
    .prepare(`SELECT equipamento_id, dia, status, os_id FROM ${gradeTable} WHERE inspecao_id = ? AND dia BETWEEN 1 AND 31`)
    .all(inspecaoId);

  const matrix = new Map();
  for (const eq of equipamentos) {
    const base = Number(eq.ativo || 0) === 1 ? "C" : "SP";
    matrix.set(eq.id, Array.from({ length: 31 }, (_, i) => ({ status: i + 1 <= dias ? base : "-", os_id: null })));
  }

  for (const row of rows) {
    const line = matrix.get(row.equipamento_id);
    if (!line) continue;
    if (row.dia >= 1 && row.dia <= 31) line[row.dia - 1] = { status: row.status || "C", os_id: row.os_id || null };
  }

  return matrix;
}

function listNC(inspecaoId) {
  const ncTable = resolveNCTable();
  const rows = db
    .prepare(
      `SELECT
        nc.id, nc.inspecao_id, nc.equipamento_id, nc.data_ocorrencia,
        nc.nao_conformidade, nc.acao_corretiva, nc.acao_preventiva,
        nc.data_correcao, nc.os_id,
        e.nome AS equipamento_nome, e.codigo AS equipamento_codigo
      FROM ${ncTable} nc
      LEFT JOIN equipamentos e ON e.id = nc.equipamento_id
      WHERE nc.inspecao_id = ?
      ORDER BY date(nc.data_ocorrencia) DESC, nc.id DESC`
    )
    .all(inspecaoId);

  return rows.map((row) => ({
    ...row,
    data_ocorrencia: formatDate(row.data_ocorrencia),
    data_correcao: formatDate(row.data_correcao),
    item: row.equipamento_codigo || row.equipamento_nome || `Eq #${row.equipamento_id || "-"}`,
  }));
}

function saveNC(inspecaoId, data = {}) {
  const ncTable = resolveNCTable();
  const id = Number(data.id || 0);
  if (!id) return;

  db.prepare(
    `UPDATE ${ncTable}
     SET acao_corretiva = COALESCE(?, acao_corretiva),
         acao_preventiva = COALESCE(?, acao_preventiva),
         data_correcao = COALESCE(?, data_correcao),
         updated_at = datetime('now')
     WHERE id = ? AND inspecao_id = ?`
  ).run(
    String(data.acao_corretiva || "").trim() || null,
    String(data.acao_preventiva || "").trim() || null,
    String(data.data_correcao || "").trim() || null,
    id,
    inspecaoId
  );
}

function updateObservation(inspecaoId, data = {}) {
  const gradeTable = resolveGradeTable();
  const equipamentoId = Number(data.equipamento_id || data.equipamento || 0);
  const dia = Number(data.dia || 0);
  if (!equipamentoId || !dia) return;

  db.prepare(
    `UPDATE ${gradeTable}
     SET observacao = ?, updated_at = datetime('now')
     WHERE inspecao_id = ? AND equipamento_id = ? AND dia = ?`
  ).run(String(data.observacao || "").trim() || null, inspecaoId, equipamentoId, dia);
}

function listOSDetailsByInspecao(_inspecaoId, mes, ano) {
  const equipamentos = listEquipamentosAtivos();
  const osRows = mapOSRowsToEquipamento(getOSByMonth(mes, ano), equipamentos);
  const map = {};

  for (const os of osRows) {
    const start = parseDate(os.data_inicio);
    if (!start) continue;
    const eqId = Number(os.mapped_equipamento_id || 0);
    if (!eqId) continue;

    const startDay = start.getDate();
    const endRaw = parseDate(os.data_fim);
    const endDay = endRaw ? endRaw.getDate() : startDay;

    for (let day = startDay; day <= endDay; day += 1) {
      const key = `${eqId}-${day}`;
      map[key] = map[key] || [];
      map[key].push({
        id: os.id,
        status: normalizeStatus(os.status),
        nao_conformidade: getColumnValue(os, ["descricao_problema", "descricao", "solicitacao", "relato", "texto_problema"]),
        resumo_tecnico: os.acao_corretiva,
        causa_diagnostico: os.acao_preventiva,
        data_inicio: formatDate(os.data_inicio),
        data_fim: formatDate(os.data_fim),
      });
    }
  }

  return map;
}

function syncFromClosedOS(osId) {
  console.log("[INSPECAO_SYNC] syncFromClosedOS:start", { osId });
  try {
    const osTable = resolveOSTable();
    const cols = tableColumns(osTable);
    const dataInicioCol = cols.includes("data_inicio") ? "data_inicio" : (cols.includes("opened_at") ? "opened_at" : "NULL");
    const dataFimCol = cols.includes("data_fim") ? "data_fim" : (cols.includes("data_conclusao") ? "data_conclusao" : (cols.includes("closed_at") ? "closed_at" : "NULL"));

    const os = db
      .prepare(
        `SELECT id, tipo, status, ${dataInicioCol} AS data_inicio, ${dataFimCol} AS data_fim, closed_by, opened_by
         FROM ${osTable}
         WHERE id = ?`
      )
      .get(osId);

    if (!os) return { synced: false, reason: "os_not_found" };
    if (!normalizeDate(os.data_inicio)) return { synced: false, reason: "os_or_data_missing" };
    if (normalizeStatus(os.status) !== "FECHADA") {
      return { synced: false, reason: "os_not_closed", status: os.status };
    }

    const dt = parseDate(os.data_inicio);
    const mes = dt.getMonth() + 1;
    const ano = dt.getFullYear();
    console.log("[INSPECAO_SYNC] mês/ano calculado", { osId, mes, ano, status: os.status, tipo: os.tipo, data_inicio: os.data_inicio, data_fim: os.data_fim });

    const inspecao = getOrCreateInspecao(mes, ano, os.closed_by || os.opened_by || null);
    const result = recalculate(inspecao.id, mes, ano);
    const payload = { synced: true, inspecaoId: inspecao.id, ...result };
    console.log("[INSPECAO_SYNC] syncFromClosedOS:done", { osId, payload });
    return payload;
  } catch (err) {
    console.error("[INSPECAO_SYNC][ERROR]", err);
    return { synced: false, reason: "sync_exception", error: err.message || String(err) };
  }
}

function syncFromOS(osId) {
  console.log("[INSPECAO_SYNC] syncFromOS:start", { osId });
  try {
    const osTable = resolveOSTable();
    const cols = tableColumns(osTable);
    const dataInicioCol = cols.includes("data_inicio") ? "data_inicio" : (cols.includes("opened_at") ? "opened_at" : "NULL");

    const os = db.prepare(`SELECT id, ${dataInicioCol} AS data_inicio FROM ${osTable} WHERE id = ?`).get(osId);
    if (!os || !normalizeDate(os.data_inicio)) return { synced: false, reason: "os_or_data_missing" };

    const dt = parseDate(os.data_inicio);
    const mes = dt.getMonth() + 1;
    const ano = dt.getFullYear();
    const inspecao = getOrCreateInspecao(mes, ano, null);
    const result = recalculate(inspecao.id, mes, ano);
    const payload = { synced: true, inspecaoId: inspecao.id, ...result };
    console.log("[INSPECAO_SYNC] syncFromOS:done", { osId, payload });
    return payload;
  } catch (err) {
    console.error("[INSPECAO_SYNC][ERROR]", err);
    return { synced: false, reason: "sync_exception", error: err.message || String(err) };
  }
}

function computeGrade(inspecaoId, mes, ano) {
  return recalculate(inspecaoId, mes, ano);
}

module.exports = {
  getOrCreateInspecao,
  getOrCreateInspection,
  daysInMonth,
  listEquipamentosAtivos,
  buildMatrix,
  listNC,
  computeGrade,
  recalculate,
  saveNC,
  updateObservation,
  updateHeader,
  listOSDetailsByInspecao,
  syncFromClosedOS,
  syncFromOS,
  getOSByMonth,
  normalizeStatus,
};
