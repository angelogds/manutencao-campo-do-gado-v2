const db = require("../../database/db");

const NC_KEYWORDS = [
  "quebrou", "quebrado", "falha", "queimou", "queimado", "rolamento", "mancal", "travou", "parou",
  "vazamento", "superaquecimento", "correia arrebentou", "correia", "motor", "bomba", "induzido", "redutor", "curto", "estourou", "quebra",
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function daysInMonth(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function dateToDay(value) {
  const iso = dateOnly(value);
  if (!iso) return null;
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getDate();
}

function monthRange(ano, mes) {
  const start = new Date(ano, mes - 1, 1);
  const end = new Date(ano, mes, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function findFirstColumn(columns, candidates) {
  return candidates.find((column) => columns.includes(column)) || null;
}

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function hasTable(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
  return !!row;
}

function resolveNCTable() {
  if (hasTable("inspecao_pac01_nc")) return "inspecao_pac01_nc";
  return "inspecao_pac01_nao_conformidades";
}

function getOSFieldMap() {
  const cols = tableColumns("os");
  return {
    id: "id",
    status: findFirstColumn(cols, ["status"]),
    equipamentoId: findFirstColumn(cols, ["equipamento_id"]),
    equipamentoNome: findFirstColumn(cols, ["equipamento", "equipamento_manual", "equipamento_nome"]),
    descricaoProblema: findFirstColumn(cols, ["descricao_problema", "descricao", "solicitacao", "relato"]),
    resumoTecnico: findFirstColumn(cols, ["resumo_tecnico", "relatorio_tecnico", "execucao", "servico_realizado", "acao_executada"]),
    causaDiagnostico: findFirstColumn(cols, ["causa", "diagnostico", "observacao_causa", "preventiva"]),
    dataInicio: findFirstColumn(cols, ["data_inicio", "opened_at", "created_at"]),
    dataFim: findFirstColumn(cols, ["data_fim", "data_conclusao", "closed_at", "fechado_em"]),
    naoConforme: findFirstColumn(cols, ["nao_conforme", "is_nao_conforme"]),
    semProducao: findFirstColumn(cols, ["sem_producao"]),
    tipo: findFirstColumn(cols, ["tipo"]),
  };
}

function getOrCreateInspecao(mes, ano, user) {
  let inspecao = db.prepare("SELECT * FROM inspecoes_pac01 WHERE mes = ? AND ano = ?").get(mes, ano);
  if (inspecao) return inspecao;

  const cols = tableColumns("inspecoes_pac01");
  const ownerCol = cols.includes("created_by") ? "created_by" : (cols.includes("criado_por") ? "criado_por" : null);

  const fields = ["mes", "ano", "frequencia", "monitor_nome", "verificador_nome"];
  const values = [mes, ano, "Diária", user?.name || null, null];
  if (ownerCol) {
    fields.push(ownerCol);
    values.push(user?.id || null);
  }

  const info = db.prepare(
    `INSERT INTO inspecoes_pac01 (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`
  ).run(...values);

  inspecao = db.prepare("SELECT * FROM inspecoes_pac01 WHERE id = ?").get(info.lastInsertRowid);
  return inspecao;
}

function listEquipamentosAtivos() {
  const cols = tableColumns("equipamentos");
  const itemExpr = cols.includes("codigo") ? "NULLIF(TRIM(codigo),'')" : "NULL";
  const ativoExpr = cols.includes("ativo") ? "COALESCE(ativo,1)" : "1";
  return db.prepare(
    `SELECT id, nome, ${itemExpr} AS item_codigo, ${ativoExpr} AS ativo
     FROM equipamentos
     ORDER BY nome`
  ).all().map((eq) => ({
    ...eq,
    ativo: Number(eq.ativo || 0) === 1,
    chave: normalizeText(eq.nome),
    item: eq.item_codigo || String(eq.id),
  }));
}

function getOSByMonth(mes, ano) {
  const map = getOSFieldMap();
  if (!map.dataInicio) return [];

  const { start, end } = monthRange(ano, mes);
  const cols = tableColumns("os");
  const dateCandidates = [map.dataInicio, "opened_at", "created_at"].filter((c) => c && cols.includes(c));
  const dateExpr = dateCandidates.length ? `COALESCE(${dateCandidates.map((c) => `o.${c}`).join(", ")})` : `o.${map.dataInicio}`;

  const sql = `
    SELECT
      o.id,
      ${map.status ? `o.${map.status}` : "NULL"} AS status,
      ${map.dataInicio ? `o.${map.dataInicio}` : "NULL"} AS data_inicio,
      ${map.dataFim ? `o.${map.dataFim}` : "NULL"} AS data_fim,
      ${map.descricaoProblema ? `o.${map.descricaoProblema}` : "NULL"} AS texto_problema,
      ${map.resumoTecnico ? `o.${map.resumoTecnico}` : "NULL"} AS resumo_tecnico,
      ${map.causaDiagnostico ? `o.${map.causaDiagnostico}` : "NULL"} AS causa_diagnostico,
      ${map.equipamentoId ? `o.${map.equipamentoId}` : "NULL"} AS equipamento_id,
      ${map.equipamentoNome ? `o.${map.equipamentoNome}` : "NULL"} AS equipamento_nome,
      ${map.naoConforme ? `o.${map.naoConforme}` : "0"} AS nao_conforme,
      ${map.semProducao ? `o.${map.semProducao}` : "0"} AS sem_producao,
      ${map.tipo ? `o.${map.tipo}` : "NULL"} AS tipo
    FROM os o
    WHERE date(${dateExpr}) >= date(?)
      AND date(${dateExpr}) < date(?)
    ORDER BY date(${dateExpr}), o.id
  `;

  return db.prepare(sql).all(start, end);
}

function mapOSToEquipamento(osRow, equipamentos, equipById, equipByName) {
  if (!osRow) return null;

  if (osRow.equipamento_id && equipById.has(Number(osRow.equipamento_id))) {
    return equipById.get(Number(osRow.equipamento_id));
  }

  const key = normalizeText(osRow.equipamento_nome);
  if (key && equipByName.has(key)) return equipByName.get(key);

  for (const [nameKey, eq] of equipByName.entries()) {
    if (!key || !nameKey) continue;
    if (nameKey.includes(key) || key.includes(nameKey)) return eq;
  }

  const fallback = equipamentos.find((eq) => normalizeText(eq.item) === key);
  return fallback || null;
}

function isNC(osRow) {
  if (!osRow) return false;
  if (Number(osRow.nao_conforme || 0) === 1) return true;

  const tipo = normalizeText(osRow.tipo);
  const problema = String(osRow.texto_problema || "").trim();
  if (tipo === "corretiva" && problema) return true;

  const status = normalizeText(osRow.status);
  if (status.includes("quebra") || status.includes("parada")) return true;

  const text = normalizeText(`${osRow.texto_problema || ""} ${osRow.causa_diagnostico || ""} ${osRow.tipo || ""}`);
  return NC_KEYWORDS.some((kw) => text.includes(normalizeText(kw)));
}

function isEA(osRow) {
  const status = normalizeText(osRow?.status);
  return status.includes("aberta") || status.includes("andamento") || status.includes("em andamento") || status.includes("pausada") || status.includes("em_andamento");
}

function isSP(osRow) {
  if (!osRow) return false;
  if (Number(osRow.sem_producao || 0) === 1) return true;
  const text = normalizeText(`${osRow.texto_problema || ""} ${osRow.causa_diagnostico || ""}`);
  return text.includes("sem producao") || text.includes("sem produção");
}

function statusPriority(status) {
  const p = { C: 0, SP: 1, EA: 2, NC: 3 };
  return p[status] ?? -1;
}

function buildMonthlyGrid(inspecao, equipamentos, osList) {
  const diasMes = daysInMonth(inspecao.ano, inspecao.mes);
  const equipById = new Map(equipamentos.map((eq) => [eq.id, eq]));
  const equipByName = new Map(equipamentos.map((eq) => [eq.chave, eq]));
  const gridMap = new Map();

  for (const eq of equipamentos) {
    const line = Array.from({ length: 31 }, (_, idx) => ({
      dia: idx + 1,
      status: idx + 1 <= diasMes ? (eq.ativo ? "C" : "SP") : "-",
      os_id: null,
      observacao: null,
    }));
    gridMap.set(eq.id, line);
  }

  const osByEquipDay = new Map();

  for (const osRow of osList) {
    const eq = mapOSToEquipamento(osRow, equipamentos, equipById, equipByName);
    if (!eq) continue;

    const startDay = dateToDay(osRow.data_inicio);
    if (!startDay || startDay > diasMes) continue;

    const endDayRaw = dateToDay(osRow.data_fim);
    const endDay = endDayRaw && endDayRaw <= diasMes ? endDayRaw : diasMes;

    const addDetailKey = `${eq.id}:${startDay}`;
    if (!osByEquipDay.has(addDetailKey)) osByEquipDay.set(addDetailKey, []);
    osByEquipDay.get(addDetailKey).push(osRow);

    const markCell = (day, status, observacao = null) => {
      if (day < 1 || day > diasMes) return;
      const cell = gridMap.get(eq.id)[day - 1];
      if (statusPriority(status) >= statusPriority(cell.status)) {
        cell.status = status;
        cell.os_id = osRow.id;
        cell.observacao = observacao;
      }
    };

    if (isNC(osRow)) {
      markCell(startDay, "NC", "Gerado automaticamente via OS");
    }

    if (isEA(osRow)) {
      const eaStart = Math.min(startDay + 1, diasMes);
      for (let day = eaStart; day <= endDay; day += 1) {
        markCell(day, "EA", "OS em andamento");
      }
    }

    if (!isNC(osRow) && !isEA(osRow) && isSP(osRow)) {
      markCell(startDay, "SP", "Sem produção");
    }
  }

  return { gridMap, osByEquipDay };
}

function buildNCList(inspecao, equipamentos, osList) {
  const equipById = new Map(equipamentos.map((eq) => [eq.id, eq]));
  const equipByName = new Map(equipamentos.map((eq) => [eq.chave, eq]));

  const ncList = [];
  for (const osRow of osList) {
    if (!isNC(osRow)) continue;
    const eq = mapOSToEquipamento(osRow, equipamentos, equipById, equipByName);
    if (!eq) continue;

    const dataOcorrencia = dateOnly(osRow.data_inicio);
    if (!dataOcorrencia) continue;

    ncList.push({
      equipamento_id: eq.id,
      item: eq.item,
      data_ocorrencia: dataOcorrencia,
      nao_conformidade: String(osRow.texto_problema || "").trim() || "Não conformidade detectada via OS",
      acao_corretiva: String(osRow.resumo_tecnico || "").trim() || null,
      acao_preventiva: String(osRow.causa_diagnostico || "").trim() || null,
      data_correcao: dateOnly(osRow.data_fim),
      os_id: osRow.id,
    });
  }

  return ncList;
}

function recalculate(inspecaoId, mes, ano) {
  const inspecao = db.prepare("SELECT * FROM inspecoes_pac01 WHERE id = ?").get(inspecaoId);
  if (!inspecao) throw new Error("Inspeção não encontrada.");

  const equipamentos = listEquipamentosAtivos();
  const currentMes = Number(mes || inspecao.mes);
  const currentAno = Number(ano || inspecao.ano);
  const osList = getOSByMonth(currentMes, currentAno);
  const { gridMap } = buildMonthlyGrid(inspecao, equipamentos, osList);
  const ncList = buildNCList(inspecao, equipamentos, osList);

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM inspecao_pac01_grade WHERE inspecao_id = ?").run(inspecao.id);

    const insertGrade = db.prepare(
      `INSERT INTO inspecao_pac01_grade (inspecao_id, equipamento_id, dia, status, os_id, observacao, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    );

    for (const eq of equipamentos) {
      const line = gridMap.get(eq.id) || [];
      for (const cell of line) {
        if (cell.status === "-") continue;
        insertGrade.run(inspecao.id, eq.id, cell.dia, cell.status, cell.os_id || null, cell.observacao || null);
      }
    }

    const keys = new Set();
    const ncTable = resolveNCTable();
    const insertNC = db.prepare(
      `INSERT INTO ${ncTable} (
        inspecao_id, equipamento_id, data_ocorrencia, nao_conformidade,
        acao_corretiva, acao_preventiva, data_correcao, os_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    );
    const selectNC = db.prepare(
      `SELECT id, acao_corretiva, acao_preventiva, data_correcao
       FROM ${ncTable}
       WHERE inspecao_id = ? AND equipamento_id = ? AND data_ocorrencia = ? AND COALESCE(os_id, 0) = COALESCE(?, 0)`
    );
    const updateNC = db.prepare(
      `UPDATE ${ncTable}
       SET nao_conformidade = ?,
           acao_corretiva = COALESCE(NULLIF(acao_corretiva, ''), ?),
           acao_preventiva = COALESCE(NULLIF(acao_preventiva, ''), ?),
           data_correcao = COALESCE(data_correcao, ?),
           updated_at = datetime('now')
       WHERE id = ?`
    );

    for (const nc of ncList) {
      keys.add(`${nc.equipamento_id}:${nc.data_ocorrencia}:${nc.os_id || 0}`);
      const existing = selectNC.get(inspecao.id, nc.equipamento_id, nc.data_ocorrencia, nc.os_id || null);
      if (existing) {
        updateNC.run(
          nc.nao_conformidade,
          nc.acao_corretiva,
          nc.acao_preventiva,
          nc.data_correcao,
          existing.id
        );
      } else {
        insertNC.run(
          inspecao.id,
          nc.equipamento_id,
          nc.data_ocorrencia,
          nc.nao_conformidade,
          nc.acao_corretiva,
          nc.acao_preventiva,
          nc.data_correcao,
          nc.os_id || null
        );
      }
    }

    const existingNC = db.prepare(`SELECT id, equipamento_id, data_ocorrencia, os_id FROM ${ncTable} WHERE inspecao_id = ?`).all(inspecao.id);
    const delNC = db.prepare(`DELETE FROM ${ncTable} WHERE id = ?`);
    for (const row of existingNC) {
      const key = `${row.equipamento_id}:${row.data_ocorrencia}:${row.os_id || 0}`;
      if (!keys.has(key)) delNC.run(row.id);
    }

    db.prepare("UPDATE inspecoes_pac01 SET updated_at = datetime('now') WHERE id = ?").run(inspecao.id);
  });

  tx();

  return { inspecao, equipamentos, osCount: osList.length };
}

function buildMatrix(inspecaoId, ano, mes, equipamentos) {
  const diasMes = daysInMonth(ano, mes);
  const grade = db.prepare(
    `SELECT g.*, e.nome AS equipamento_nome, e.codigo AS equipamento_codigo
     FROM inspecao_pac01_grade g
     JOIN equipamentos e ON e.id = g.equipamento_id
     WHERE g.inspecao_id = ?
     ORDER BY e.nome, g.dia`
  ).all(inspecaoId);

  const matrix = new Map();
  for (const eq of equipamentos) {
    matrix.set(eq.id, Array.from({ length: 31 }, (_, idx) => ({
      dia: idx + 1,
      status: idx + 1 <= diasMes ? "C" : "-",
      os_id: null,
      observacao: null,
    })));
  }

  for (const row of grade) {
    if (!matrix.has(row.equipamento_id)) continue;
    matrix.get(row.equipamento_id)[row.dia - 1] = {
      dia: row.dia,
      status: row.status,
      os_id: row.os_id,
      observacao: row.observacao,
    };
  }

  return matrix;
}

function listNC(inspecaoId) {
  const ncTable = resolveNCTable();
  const ncCols = tableColumns(ncTable);
  const ncEquipNomeExpr = ncCols.includes("equipamento_nome") ? "nc.equipamento_nome" : "NULL";
  return db.prepare(
    `SELECT nc.*, e.nome AS equipamento_nome, e.codigo AS equipamento_codigo, ${ncEquipNomeExpr} AS nc_equipamento_nome
     FROM ${ncTable} nc
     LEFT JOIN equipamentos e ON e.id = nc.equipamento_id
     WHERE nc.inspecao_id = ?
     ORDER BY nc.data_ocorrencia DESC, COALESCE(e.nome, ${ncEquipNomeExpr}, '') ASC`
  ).all(inspecaoId).map((row) => ({
    ...row,
    item: row.equipamento_codigo || String(row.equipamento_id || row.nc_equipamento_nome || "-"),
  }));
}

function listOSDetailsByInspecao(inspecaoId, mes, ano) {
  const equipamentos = listEquipamentosAtivos();
  const osList = getOSByMonth(mes, ano);
  const equipById = new Map(equipamentos.map((eq) => [eq.id, eq]));
  const equipByName = new Map(equipamentos.map((eq) => [eq.chave, eq]));
  const details = {};

  for (const osRow of osList) {
    const eq = mapOSToEquipamento(osRow, equipamentos, equipById, equipByName);
    if (!eq) continue;
    const dia = dateToDay(osRow.data_inicio);
    if (!dia) continue;
    const key = `${eq.id}-${dia}`;
    if (!details[key]) details[key] = [];
    details[key].push({
      id: osRow.id,
      status: osRow.status,
      nao_conformidade: osRow.texto_problema,
      resumo_tecnico: osRow.resumo_tecnico,
      causa_diagnostico: osRow.causa_diagnostico,
      data_inicio: dateOnly(osRow.data_inicio),
      data_fim: dateOnly(osRow.data_fim),
      is_nc: isNC(osRow),
    });
  }

  const observacoes = hasTable("inspecao_pac01_grade")
    ? db.prepare("SELECT equipamento_id, dia, observacao FROM inspecao_pac01_grade WHERE inspecao_id = ? AND observacao IS NOT NULL").all(inspecaoId)
    : [];

  for (const row of observacoes) {
    const key = `${row.equipamento_id}-${row.dia}`;
    if (!details[key]) details[key] = [];
    details[key].observacao = row.observacao;
  }

  return details;
}

function saveNC(inspecaoId, payload) {
  const id = Number(payload.id || 0);
  if (!id) throw new Error("Não conformidade inválida.");
  const ncTable = resolveNCTable();

  db.prepare(
    `UPDATE ${ncTable}
     SET acao_corretiva = ?,
         acao_preventiva = ?,
         data_correcao = ?,
         updated_at = datetime('now')
     WHERE id = ? AND inspecao_id = ?`
  ).run(
    String(payload.acao_corretiva || "").trim() || null,
    String(payload.acao_preventiva || "").trim() || null,
    payload.data_correcao || null,
    id,
    inspecaoId
  );
}

function updateObservation(inspecaoId, { equipamento_id, dia, observacao }) {
  db.prepare(
    `UPDATE inspecao_pac01_grade
     SET observacao = ?, updated_at = datetime('now')
     WHERE inspecao_id = ? AND equipamento_id = ? AND dia = ?`
  ).run(String(observacao || "").trim() || null, inspecaoId, Number(equipamento_id), Number(dia));
}

function updateHeader(inspecaoId, payload) {
  db.prepare(
    `UPDATE inspecoes_pac01
     SET monitor_nome = ?,
         verificador_nome = ?,
         frequencia = COALESCE(NULLIF(?, ''), frequencia),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(payload.monitor_nome || "").trim() || null,
    String(payload.verificador_nome || "").trim() || null,
    payload.frequencia || null,
    inspecaoId
  );
}

function syncFromOS(osId) {
  if (!osId) return { synced: false, reason: "os_id_missing" };
  const cols = tableColumns("os");
  const parts = ["id"];
  if (cols.includes("data_inicio")) parts.push("data_inicio");
  if (cols.includes("opened_at")) parts.push("opened_at");
  if (cols.includes("created_at")) parts.push("created_at");
  const row = db.prepare(`SELECT ${parts.join(",")} FROM os WHERE id = ?`).get(osId);
  if (!row) return { synced: false, reason: "os_not_found" };

  const data = row.data_inicio || row.opened_at || row.created_at;
  if (!data) return { synced: false, reason: "os_or_data_missing" };

  const dt = new Date(`${dateOnly(data)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return { synced: false, reason: "invalid_date" };

  const mes = dt.getMonth() + 1;
  const ano = dt.getFullYear();
  const inspecao = getOrCreateInspecao(mes, ano, null);
  recalculate(inspecao.id, mes, ano);
  return { synced: true, inspecao_id: inspecao.id, mes, ano };
}

function syncFromClosedOS(osId) {
  if (!osId) return { synced: false, reason: "os_id_missing" };
  const map = getOSFieldMap();
  const dateCol = map.dataInicio || "created_at";
  const closeCol = map.dataFim || "closed_at";
  const statusCol = map.status || "status";
  const row = db.prepare(
    `SELECT id, ${statusCol} AS status, ${dateCol} AS data_inicio, ${closeCol} AS data_fim FROM os WHERE id = ?`
  ).get(osId);
  if (!row) return { synced: false, reason: "os_not_found" };
  if (normalizeText(row.status) !== "fechada") return { synced: false, reason: "os_not_closed" };
  if (!row.data_inicio) return { synced: false, reason: "os_or_data_missing" };

  const dt = new Date(`${dateOnly(row.data_inicio)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return { synced: false, reason: "invalid_date" };

  const mes = dt.getMonth() + 1;
  const ano = dt.getFullYear();
  const inspecao = getOrCreateInspecao(mes, ano, null);
  recalculate(inspecao.id, mes, ano);
  return { synced: true, inspecao_id: inspecao.id, mes, ano };
}

module.exports = {
  normalizeText,
  daysInMonth,
  getOrCreateInspecao,
  listEquipamentosAtivos,
  getOSByMonth,
  mapOSToEquipamento,
  buildMonthlyGrid,
  computeGrade: buildMonthlyGrid,
  buildNCList,
  recalculate,
  buildMatrix,
  listNC,
  listOSDetailsByInspecao,
  saveNC,
  updateHeader,
  updateObservation,
  syncFromOS,
  syncFromClosedOS,
};
