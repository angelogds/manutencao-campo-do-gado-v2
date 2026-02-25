const db = require("../../database/db");

const DEFAULT_EQUIPAMENTOS = [
  "Caldeira 1", "Caldeira 2", "Caldeira 3", "Rosca da tolva 1", "Rosca da tolva 2", "Triturador 1", "Triturador 2",
  "Digestor 1", "Digestor 2", "Digestor 3", "Digestor 4", "Percoladora", "Roscas transportadoras", "Tanque mexedor de sebo",
  "Borreira", "Prensa 1", "Prensa 2", "Esterilizador", "Moegas", "Moinho", "Ensacadeira de farinha de carne e ossos",
  "Tanque intermediário", "Tanque clarificador", "Tanques de armazenamento de sebo", "Decanter 1", "Decanter 2",
  "Tanque de recebimento de sangue", "Digestor de sangue", "Ensacadeira de farinha de sangue",
];

const NC_KEYWORDS = [
  "quebrou", "quebrado", "falha", "rolamento", "mancal", "trincou", "parou", "travou", "vazamento",
  "superaquecimento", "correia arrebentou", "nao conforme", "não conforme", "avaria", "defeito", "pane", "quebra", "queimada",
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function dayFromDate(value) {
  if (!value) return null;
  const dt = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getDate();
}

function monthYearFromDate(value) {
  const dt = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return { mes: dt.getMonth() + 1, ano: dt.getFullYear() };
}

function tableExists(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  return !!row;
}

function hasInspecaoTables() {
  return tableExists("inspecoes_pac01") && tableExists("inspecao_pac01_itens") && tableExists("inspecao_pac01_nao_conformidades");
}

function getOSColumns() {
  return db.prepare("PRAGMA table_info(os)").all().map((c) => c.name);
}

function findFirstColumn(cols, list) {
  return list.find((c) => cols.includes(c)) || null;
}

function buildPeriodoISO(ano, mes) {
  const mm = String(mes).padStart(2, "0");
  return { start: `${ano}-${mm}-01`, end: `${ano}-${mm}-${String(daysInMonth(ano, mes)).padStart(2, "0")}` };
}

function getOrCreateInspecao(mes, ano, user) {
  if (!hasInspecaoTables()) throw new Error("Tabelas de inspeção não encontradas. Rode migrations.");
  let row = db.prepare("SELECT * FROM inspecoes_pac01 WHERE mes = ? AND ano = ?").get(mes, ano);
  if (!row) {
    const info = db.prepare(
      `INSERT INTO inspecoes_pac01 (mes, ano, frequencia, monitor_nome, verificador_nome, criado_por)
       VALUES (?, ?, 'Diária', ?, ?, ?)`
    ).run(mes, ano, user?.name || null, user?.name || null, user?.id || null);
    row = db.prepare("SELECT * FROM inspecoes_pac01 WHERE id = ?").get(info.lastInsertRowid);
  }
  return row;
}

function listEquipamentosAtivos() {
  const list = db.prepare("SELECT id, nome FROM equipamentos WHERE ativo = 1 ORDER BY nome").all();
  if (list.length) return list.map((item) => ({ id: item.id, nome: item.nome, chave: normalizeText(item.nome) }));
  return DEFAULT_EQUIPAMENTOS.map((nome) => ({ id: null, nome, chave: normalizeText(nome) }));
}

function fetchOSByMonth(mes, ano) {
  const cols = getOSColumns();
  const dataInicioCol = findFirstColumn(cols, ["data_inicio", "started_at", "opened_at", "created_at"]);
  const dataFimCol = findFirstColumn(cols, ["data_conclusao", "closed_at", "data_fim"]);
  const descCol = findFirstColumn(cols, ["descricao", "diagnostico", "acao_executada"]);
  const causaCol = findFirstColumn(cols, ["causa_parada", "causa", "motivo", "diagnostico"]);
  const ncCol = findFirstColumn(cols, ["is_nao_conforme", "nao_conforme"]);
  const acaoCol = findFirstColumn(cols, ["acao_executada", "acao", "solucao"]);
  const diagCol = findFirstColumn(cols, ["diagnostico", "causa", "motivo"]);

  if (!dataInicioCol) return [];
  const { start, end } = buildPeriodoISO(ano, mes);

  return db.prepare(
    `SELECT
      o.id,
      ${cols.includes("equipamento_id") ? "o.equipamento_id" : "NULL"} AS equipamento_id,
      ${cols.includes("equipamento") ? "o.equipamento" : "NULL"} AS equipamento_nome,
      ${cols.includes("status") ? "o.status" : "''"} AS status,
      ${descCol ? `o.${descCol}` : "''"} AS descricao,
      ${causaCol ? `o.${causaCol}` : "''"} AS causa,
      ${acaoCol ? `o.${acaoCol}` : "''"} AS acao_executada,
      ${diagCol ? `o.${diagCol}` : "''"} AS diagnostico,
      ${dataInicioCol ? `o.${dataInicioCol}` : "NULL"} AS data_inicio,
      ${dataFimCol ? `o.${dataFimCol}` : "NULL"} AS data_fim,
      ${ncCol ? `o.${ncCol}` : "0"} AS is_nao_conforme,
      ${cols.includes("tipo") ? "o.tipo" : "''"} AS tipo
     FROM os o
     WHERE substr(o.${dataInicioCol},1,10) BETWEEN ? AND ?`
  ).all(start, end);
}

function fetchOSById(osId) {
  const cols = getOSColumns();
  const dataInicioCol = findFirstColumn(cols, ["data_inicio", "started_at", "opened_at", "created_at"]);
  const dataFimCol = findFirstColumn(cols, ["data_conclusao", "closed_at", "data_fim"]);
  if (!dataInicioCol) return null;

  return db.prepare(
    `SELECT
      o.id,
      ${cols.includes("equipamento_id") ? "o.equipamento_id" : "NULL"} AS equipamento_id,
      ${cols.includes("equipamento") ? "o.equipamento" : "NULL"} AS equipamento_nome,
      ${cols.includes("status") ? "o.status" : "''"} AS status,
      ${cols.includes("descricao") ? "o.descricao" : "''"} AS descricao,
      ${findFirstColumn(cols, ["causa_parada", "causa", "motivo", "diagnostico"]) ? `o.${findFirstColumn(cols, ["causa_parada", "causa", "motivo", "diagnostico"])}` : "''"} AS causa,
      ${findFirstColumn(cols, ["acao_executada", "acao", "solucao"]) ? `o.${findFirstColumn(cols, ["acao_executada", "acao", "solucao"])}` : "''"} AS acao_executada,
      ${findFirstColumn(cols, ["diagnostico", "causa", "motivo"]) ? `o.${findFirstColumn(cols, ["diagnostico", "causa", "motivo"])}` : "''"} AS diagnostico,
      ${dataInicioCol ? `o.${dataInicioCol}` : "NULL"} AS data_inicio,
      ${dataFimCol ? `o.${dataFimCol}` : "NULL"} AS data_fim,
      ${findFirstColumn(cols, ["is_nao_conforme", "nao_conforme"]) ? `o.${findFirstColumn(cols, ["is_nao_conforme", "nao_conforme"])}` : "0"} AS is_nao_conforme,
      ${cols.includes("tipo") ? "o.tipo" : "''"} AS tipo
     FROM os o WHERE o.id = ?`
  ).get(osId);
}

function detectNC(os) {
  if (!os) return false;
  if (Number(os.is_nao_conforme || 0) === 1) return true;
  const text = normalizeText(`${os.descricao} ${os.causa} ${os.diagnostico}`);
  if (NC_KEYWORDS.some((kw) => text.includes(normalizeText(kw)))) return true;
  return normalizeText(os.tipo) === "corretiva" && text.length > 0;
}

function detectSP(os) {
  const joined = normalizeText(`${os.descricao} ${os.causa}`);
  return joined.includes("sem producao") || joined.includes("sem produção");
}

function statusPriority(status) {
  return ({ C: 0, SP: 1, EA: 2, NC: 3 })[status] ?? -1;
}

function buildEquipmentMap(equipamentos) {
  const map = new Map();
  equipamentos.forEach((eq) => map.set(eq.chave, eq));
  return map;
}

function resolveEquipamentoFromOS(os, equipamentoMap) {
  if (!os) return null;
  if (os.equipamento_id) {
    const found = db.prepare("SELECT id, nome FROM equipamentos WHERE id = ?").get(os.equipamento_id);
    if (found?.nome) return { id: found.id, nome: found.nome, chave: normalizeText(found.nome) };
  }
  const key = normalizeText(os.equipamento_nome || "");
  if (equipamentoMap.has(key)) return equipamentoMap.get(key);
  for (const [k, eq] of equipamentoMap.entries()) {
    if (!k || !key) continue;
    if (k.includes(key) || key.includes(k)) return eq;
  }
  return null;
}

function deriveStatusFromOS(os) {
  const statusNorm = normalizeText(os?.status);
  if (detectNC(os)) return "NC";
  if (statusNorm.includes("aberta") || statusNorm.includes("andamento") || statusNorm.includes("em_andamento")) return "EA";
  if (detectSP(os)) return "SP";
  return "C";
}

function upsertGradeItem(inspecaoId, equipamento, dia, status, osId, observacao, isManual = 0) {
  const exists = db.prepare(
    `SELECT id, is_manual FROM inspecao_pac01_itens
     WHERE inspecao_id = ? AND equipamento_nome = ? AND dia = ?`
  ).get(inspecaoId, equipamento.nome, dia);

  if (!exists) {
    db.prepare(
      `INSERT INTO inspecao_pac01_itens
      (inspecao_id, equipamento_id, equipamento_nome, dia, status, os_id, observacao, is_manual)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(inspecaoId, equipamento.id || null, equipamento.nome, dia, status, osId || null, observacao || null, Number(isManual || 0));
    return;
  }

  if (Number(exists.is_manual || 0) === 1 && Number(isManual || 0) === 0) return;

  db.prepare(
    `UPDATE inspecao_pac01_itens
     SET status = ?, os_id = ?, observacao = COALESCE(?, observacao), is_manual = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(status, osId || null, observacao || null, Number(isManual || 0), exists.id);
}

function upsertNaoConformidade(inspecaoId, equipamento, dataOcorrencia, dadosOS, textos = {}) {
  if (!dataOcorrencia) return;
  const osId = dadosOS?.id || null;

  const existing = db.prepare(
    `SELECT * FROM inspecao_pac01_nao_conformidades
     WHERE inspecao_id = ? AND equipamento_nome = ? AND data_ocorrencia = ? AND COALESCE(os_id,0) = COALESCE(?,0)`
  ).get(inspecaoId, equipamento.nome, dataOcorrencia, osId);

  const naoConformidade = textos.nao_conformidade || dadosOS?.descricao || dadosOS?.causa || "Não conformidade detectada";
  const acaoCorretivaAuto = textos.acao_corretiva || dadosOS?.acao_executada || null;
  const acaoPreventivaAuto = textos.acao_preventiva || dadosOS?.diagnostico || dadosOS?.causa || null;
  const causaParada = dadosOS?.causa || dadosOS?.diagnostico || null;

  if (!existing) {
    db.prepare(
      `INSERT INTO inspecao_pac01_nao_conformidades
      (inspecao_id, equipamento_id, equipamento_nome, data_ocorrencia, nao_conformidade, acao_corretiva, acao_preventiva, data_correcao, os_id, os_data_inicio, os_data_fim, causa_parada)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      inspecaoId, equipamento.id || null, equipamento.nome, dataOcorrencia, naoConformidade,
      acaoCorretivaAuto, acaoPreventivaAuto, textos.data_correcao || null, osId,
      dadosOS?.data_inicio || null, dadosOS?.data_fim || null, causaParada
    );
    return;
  }

  db.prepare(
    `UPDATE inspecao_pac01_nao_conformidades
     SET nao_conformidade = COALESCE(NULLIF(?, ''), nao_conformidade),
         acao_corretiva = COALESCE(NULLIF(acao_corretiva, ''), NULLIF(?, ''), acao_corretiva),
         acao_preventiva = COALESCE(NULLIF(acao_preventiva, ''), NULLIF(?, ''), acao_preventiva),
         data_correcao = COALESCE(data_correcao, ?),
         os_data_inicio = COALESCE(os_data_inicio, ?),
         os_data_fim = COALESCE(os_data_fim, ?),
         causa_parada = COALESCE(NULLIF(causa_parada, ''), ?),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    naoConformidade, acaoCorretivaAuto, acaoPreventivaAuto,
    textos.data_correcao || null, dadosOS?.data_inicio || null, dadosOS?.data_fim || null,
    causaParada, existing.id
  );
}

function computeGrade(inspecaoId, equipamentos, osList, ano, mes) {
  const dias = daysInMonth(ano, mes);
  const equipamentoMap = buildEquipmentMap(equipamentos);
  const matrix = new Map();

  equipamentos.forEach((eq) => {
    matrix.set(eq.nome, new Map());
    for (let dia = 1; dia <= dias; dia += 1) matrix.get(eq.nome).set(dia, { status: "C", os: null, obs: null });
  });

  for (const os of osList) {
    const equipamento = resolveEquipamentoFromOS(os, equipamentoMap);
    if (!equipamento) continue;
    const dia = dayFromDate(os.data_inicio);
    if (!dia || dia > dias) continue;

    const candidate = deriveStatusFromOS(os);
    const current = matrix.get(equipamento.nome).get(dia) || { status: "C", os: null };
    if (statusPriority(candidate) >= statusPriority(current.status)) {
      matrix.get(equipamento.nome).set(dia, { status: candidate, os, obs: candidate === "NC" ? "Detectado por OS" : null });
    }
  }

  db.transaction(() => {
    for (const eq of equipamentos) {
      const row = matrix.get(eq.nome);
      for (let dia = 1; dia <= dias; dia += 1) {
        const item = row.get(dia) || { status: "C", os: null, obs: null };
        upsertGradeItem(inspecaoId, eq, dia, item.status, item.os?.id || null, item.obs || null, 0);
        if (item.status === "NC" && item.os) {
          upsertNaoConformidade(inspecaoId, eq, String(item.os.data_inicio || "").slice(0, 10), item.os, {
            nao_conformidade: item.os.descricao || item.os.causa || "Não conformidade detectada",
            acao_corretiva: item.os.acao_executada || null,
            acao_preventiva: item.os.diagnostico || item.os.causa || null,
            data_correcao: item.os.data_fim ? String(item.os.data_fim).slice(0, 10) : null,
          });
        }
      }
    }
  })();
}

function recalculate(inspecaoId) {
  const inspecao = db.prepare("SELECT * FROM inspecoes_pac01 WHERE id = ?").get(inspecaoId);
  if (!inspecao) throw new Error("Inspeção não encontrada.");
  const equipamentos = listEquipamentosAtivos();
  const osList = fetchOSByMonth(inspecao.mes, inspecao.ano);
  computeGrade(inspecao.id, equipamentos, osList, inspecao.ano, inspecao.mes);
  db.prepare("UPDATE inspecoes_pac01 SET updated_at = datetime('now') WHERE id = ?").run(inspecao.id);
  return { inspecao, equipamentos, osCount: osList.length };
}

function syncFromOS(osId, user = null) {
  if (!hasInspecaoTables()) return { synced: false, reason: "tables_missing" };
  const os = fetchOSById(Number(osId));
  if (!os?.data_inicio) return { synced: false, reason: "os_or_data_missing" };
  const period = monthYearFromDate(os.data_inicio);
  if (!period) return { synced: false, reason: "invalid_date" };

  const inspecao = getOrCreateInspecao(period.mes, period.ano, user || {});
  const equipamentos = listEquipamentosAtivos();
  const equipamento = resolveEquipamentoFromOS(os, buildEquipmentMap(equipamentos));
  if (!equipamento) return { synced: false, reason: "equipamento_not_mapped" };

  const dia = dayFromDate(os.data_inicio);
  if (!dia) return { synced: false, reason: "dia_invalid" };

  const status = deriveStatusFromOS(os);
  upsertGradeItem(inspecao.id, equipamento, dia, status, os.id, "Atualizado automaticamente pela OS", 0);

  if (status === "NC") {
    upsertNaoConformidade(inspecao.id, equipamento, String(os.data_inicio).slice(0, 10), os, {
      nao_conformidade: os.descricao || os.causa || "Não conformidade detectada",
      acao_corretiva: os.acao_executada || null,
      acao_preventiva: os.diagnostico || os.causa || null,
      data_correcao: os.data_fim ? String(os.data_fim).slice(0, 10) : null,
    });
  }

  db.prepare("UPDATE inspecoes_pac01 SET updated_at = datetime('now') WHERE id = ?").run(inspecao.id);
  return { synced: true, status, inspecaoId: inspecao.id };
}

function buildMatrix(inspecaoId, ano, mes, equipamentos) {
  const diasMes = daysInMonth(ano, mes);
  const itens = db.prepare(
    `SELECT equipamento_nome, dia, status, os_id, observacao, is_manual
     FROM inspecao_pac01_itens WHERE inspecao_id = ? ORDER BY equipamento_nome, dia`
  ).all(inspecaoId);

  const byEquip = new Map();
  equipamentos.forEach((eq) => {
    byEquip.set(eq.nome, Array.from({ length: 31 }, (_, idx) => ({ dia: idx + 1, status: idx + 1 <= diasMes ? "C" : "-", os_id: null, observacao: null, is_manual: 0 })));
  });

  itens.forEach((item) => {
    if (!byEquip.has(item.equipamento_nome)) return;
    byEquip.get(item.equipamento_nome)[item.dia - 1] = { dia: item.dia, status: item.status, os_id: item.os_id, observacao: item.observacao, is_manual: item.is_manual };
  });

  return byEquip;
}

function listNC(inspecaoId, filters = {}) {
  const where = ["inspecao_id = ?"];
  const args = [inspecaoId];
  if (filters.equipamento_nome) {
    where.push("equipamento_nome = ?");
    args.push(filters.equipamento_nome);
  }
  return db.prepare(
    `SELECT * FROM inspecao_pac01_nao_conformidades WHERE ${where.join(" AND ")} ORDER BY data_ocorrencia DESC, equipamento_nome ASC`
  ).all(...args);
}

function updateGradeManual(inspecaoId, { equipamento_nome, dia, status, observacao, os_id }) {
  upsertGradeItem(inspecaoId, { id: null, nome: equipamento_nome }, Number(dia), status, os_id ? Number(os_id) : null, observacao || null, 1);
}

function saveNC(inspecaoId, payload) {
  const id = Number(payload.id || 0);
  if (!id) throw new Error("ID de NC inválido.");
  const nc = db.prepare("SELECT * FROM inspecao_pac01_nao_conformidades WHERE id = ? AND inspecao_id = ?").get(id, inspecaoId);
  if (!nc) throw new Error("Não conformidade não encontrada.");

  db.prepare(
    `UPDATE inspecao_pac01_nao_conformidades
     SET acao_corretiva = ?, acao_preventiva = ?, data_correcao = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(String(payload.acao_corretiva || "").trim() || null, String(payload.acao_preventiva || "").trim() || null, payload.data_correcao || null, id);
}

function updateHeader(inspecaoId, payload) {
  db.prepare(
    `UPDATE inspecoes_pac01
     SET monitor_nome = ?, verificador_nome = ?, frequencia = COALESCE(NULLIF(?, ''), frequencia), updated_at = datetime('now')
     WHERE id = ?`
  ).run(String(payload.monitor_nome || "").trim() || null, String(payload.verificador_nome || "").trim() || null, payload.frequencia || null, inspecaoId);
}

module.exports = {
  DEFAULT_EQUIPAMENTOS,
  normalizeText,
  daysInMonth,
  getOrCreateInspecao,
  listEquipamentosAtivos,
  fetchOSByMonth,
  detectNC,
  computeGrade,
  upsertGradeItem,
  upsertNaoConformidade,
  recalculate,
  syncFromOS,
  buildMatrix,
  listNC,
  updateGradeManual,
  saveNC,
  updateHeader,
};
