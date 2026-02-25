const db = require("../../database/db");

const DEFAULT_EQUIPAMENTOS = [
  "Caldeira 1",
  "Caldeira 2",
  "Caldeira 3",
  "Rosca da tolva 1",
  "Rosca da tolva 2",
  "Triturador 1",
  "Triturador 2",
  "Digestor 1",
  "Digestor 2",
  "Digestor 3",
  "Digestor 4",
  "Percoladora",
  "Roscas transportadoras",
  "Tanque mexedor de sebo",
  "Borreira",
  "Prensa 1",
  "Prensa 2",
  "Esterilizador",
  "Moegas",
  "Moinho",
  "Ensacadeira de farinha de carne e ossos",
  "Tanque intermediário",
  "Tanque clarificador",
  "Tanques de armazenamento de sebo",
  "Decanter 1",
  "Decanter 2",
  "Tanque de recebimento de sangue",
  "Digestor de sangue",
  "Ensacadeira de farinha de sangue",
];

const NC_KEYWORDS = [
  "quebrou", "quebrado", "falha", "rolamento", "mancal", "trincou", "parou", "travou",
  "vazamento", "superaquecimento", "correia arrebentou", "nao conforme", "não conforme", "avaria",
  "defeito", "pane", "quebra",
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
  const iso = String(value).slice(0, 10);
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getDate();
}

function getOSColumns() {
  return db.prepare("PRAGMA table_info(os)").all().map((c) => c.name);
}

function findFirstColumn(cols, list) {
  for (const name of list) {
    if (cols.includes(name)) return name;
  }
  return null;
}

function buildPeriodoISO(ano, mes) {
  const mm = String(mes).padStart(2, "0");
  const start = `${ano}-${mm}-01`;
  const end = `${ano}-${mm}-${String(daysInMonth(ano, mes)).padStart(2, "0")}`;
  return { start, end };
}

function getOrCreateInspecao(mes, ano, user) {
  let row = db
    .prepare("SELECT * FROM inspecoes_pac01 WHERE mes = ? AND ano = ?")
    .get(mes, ano);

  if (!row) {
    const info = db
      .prepare(
        `INSERT INTO inspecoes_pac01 (mes, ano, frequencia, monitor_nome, verificador_nome, criado_por)
         VALUES (?, ?, 'Diária', ?, ?, ?)`
      )
      .run(
        mes,
        ano,
        user?.name || null,
        user?.name || null,
        user?.id || null
      );

    row = db.prepare("SELECT * FROM inspecoes_pac01 WHERE id = ?").get(info.lastInsertRowid);
  }

  return row;
}

function listEquipamentosAtivos() {
  const list = db
    .prepare("SELECT id, nome FROM equipamentos WHERE ativo = 1 ORDER BY nome")
    .all();

  if (list.length) {
    return list.map((item) => ({ id: item.id, nome: item.nome, chave: normalizeText(item.nome) }));
  }

  return DEFAULT_EQUIPAMENTOS.map((nome) => ({ id: null, nome, chave: normalizeText(nome) }));
}

function fetchOSByMonth(mes, ano) {
  const cols = getOSColumns();
  const equipamentoExpr = cols.includes("equipamento") ? "o.equipamento" : "NULL";
  const equipamentoIdExpr = cols.includes("equipamento_id") ? "o.equipamento_id" : "NULL";
  const statusExpr = cols.includes("status") ? "o.status" : "''";

  const dataInicioCol = findFirstColumn(cols, ["data_inicio", "started_at", "opened_at", "created_at"]);
  const dataFimCol = findFirstColumn(cols, ["data_conclusao", "closed_at", "data_fim"]);
  const descCol = findFirstColumn(cols, ["descricao", "diagnostico", "acao_executada"]);
  const causaCol = findFirstColumn(cols, ["causa_parada", "causa", "motivo", "diagnostico"]);
  const ncCol = findFirstColumn(cols, ["is_nao_conforme", "nao_conforme"]);

  if (!dataInicioCol) return [];

  const { start, end } = buildPeriodoISO(ano, mes);

  return db
    .prepare(
      `SELECT
        o.id,
        ${equipamentoIdExpr} AS equipamento_id,
        ${equipamentoExpr} AS equipamento_nome,
        ${statusExpr} AS status,
        ${descCol ? `o.${descCol}` : "''"} AS descricao,
        ${causaCol ? `o.${causaCol}` : "''"} AS causa,
        ${dataInicioCol ? `o.${dataInicioCol}` : "NULL"} AS data_inicio,
        ${dataFimCol ? `o.${dataFimCol}` : "NULL"} AS data_fim,
        ${ncCol ? `o.${ncCol}` : "0"} AS is_nao_conforme
       FROM os o
       WHERE substr(${dataInicioCol ? `o.${dataInicioCol}` : "''"},1,10) BETWEEN ? AND ?`
    )
    .all(start, end);
}

function detectNC(os) {
  if (!os) return false;
  if (Number(os.is_nao_conforme || 0) === 1) return true;

  const text = normalizeText(`${os.descricao || ""} ${os.causa || ""}`);
  return NC_KEYWORDS.some((kw) => text.includes(normalizeText(kw)));
}

function detectSP(os) {
  const joined = normalizeText(`${os.descricao || ""} ${os.causa || ""}`);
  return joined.includes("sem producao") || joined.includes("sem produção");
}

function statusPriority(status) {
  const map = { C: 0, SP: 1, EA: 2, NC: 3 };
  return map[status] ?? -1;
}

function buildEquipmentMap(equipamentos) {
  const map = new Map();
  for (const eq of equipamentos) {
    map.set(eq.chave, eq);
  }
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

  for (const [mapKey, eq] of equipamentoMap.entries()) {
    if (!mapKey || !key) continue;
    if (mapKey.includes(key) || key.includes(mapKey)) return eq;
  }

  return null;
}

function upsertGradeItem(inspecaoId, equipamento, dia, status, osId, observacao, isManual = 0) {
  const exists = db
    .prepare(
      `SELECT id, status, is_manual
       FROM inspecao_pac01_itens
       WHERE inspecao_id = ? AND equipamento_nome = ? AND dia = ?`
    )
    .get(inspecaoId, equipamento.nome, dia);

  if (!exists) {
    db.prepare(
      `INSERT INTO inspecao_pac01_itens
      (inspecao_id, equipamento_id, equipamento_nome, dia, status, os_id, observacao, is_manual)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      inspecaoId,
      equipamento.id || null,
      equipamento.nome,
      dia,
      status,
      osId || null,
      observacao || null,
      Number(isManual || 0)
    );
    return;
  }

  if (Number(exists.is_manual || 0) === 1 && Number(isManual || 0) === 0) {
    return;
  }

  db.prepare(
    `UPDATE inspecao_pac01_itens
     SET status = ?,
         os_id = ?,
         observacao = COALESCE(?, observacao),
         is_manual = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(status, osId || null, observacao || null, Number(isManual || 0), exists.id);
}

function upsertNaoConformidade(inspecaoId, equipamento, dataOcorrencia, dadosOS, textos = {}) {
  if (!dataOcorrencia) return;
  const osId = dadosOS?.id || null;

  const existing = db
    .prepare(
      `SELECT *
       FROM inspecao_pac01_nao_conformidades
       WHERE inspecao_id = ? AND equipamento_nome = ? AND data_ocorrencia = ? AND COALESCE(os_id,0) = COALESCE(?,0)`
    )
    .get(inspecaoId, equipamento.nome, dataOcorrencia, osId);

  const ncTexto = textos.nao_conformidade || dadosOS?.descricao || dadosOS?.causa || "Não conformidade detectada";
  const causaParada = dadosOS?.causa || dadosOS?.descricao || null;

  if (!existing) {
    db.prepare(
      `INSERT INTO inspecao_pac01_nao_conformidades
      (inspecao_id, equipamento_id, equipamento_nome, data_ocorrencia, nao_conformidade, acao_corretiva, acao_preventiva, data_correcao, os_id, os_data_inicio, os_data_fim, causa_parada)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      inspecaoId,
      equipamento.id || null,
      equipamento.nome,
      dataOcorrencia,
      ncTexto,
      textos.acao_corretiva || null,
      textos.acao_preventiva || null,
      textos.data_correcao || null,
      osId,
      dadosOS?.data_inicio || null,
      dadosOS?.data_fim || null,
      causaParada
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
    ncTexto,
    textos.acao_corretiva || null,
    textos.acao_preventiva || null,
    textos.data_correcao || null,
    dadosOS?.data_inicio || null,
    dadosOS?.data_fim || null,
    causaParada,
    existing.id
  );
}

function computeGrade(inspecaoId, equipamentos, osList, ano, mes) {
  const dias = daysInMonth(ano, mes);
  const equipamentoMap = buildEquipmentMap(equipamentos);

  const matrix = new Map();
  for (const eq of equipamentos) {
    matrix.set(eq.nome, new Map());
    for (let dia = 1; dia <= dias; dia += 1) {
      matrix.get(eq.nome).set(dia, { status: "C", os: null, obs: null });
    }
  }

  for (const os of osList) {
    const equipamento = resolveEquipamentoFromOS(os, equipamentoMap);
    if (!equipamento) continue;

    const dia = dayFromDate(os.data_inicio);
    if (!dia || dia > dias) continue;

    const row = matrix.get(equipamento.nome);
    if (!row) continue;

    const statusNorm = normalizeText(os.status);
    let candidate = "C";
    if (detectNC(os)) candidate = "NC";
    else if (statusNorm.includes("aberta") || statusNorm.includes("andamento") || statusNorm.includes("em_andamento")) candidate = "EA";
    else if (detectSP(os)) candidate = "SP";

    const current = row.get(dia) || { status: "C", os: null };
    if (statusPriority(candidate) >= statusPriority(current.status)) {
      row.set(dia, {
        status: candidate,
        os,
        obs: candidate === "NC" ? "Detectado por OS" : null,
      });
    }
  }

  const tx = db.transaction(() => {
    for (const eq of equipamentos) {
      const row = matrix.get(eq.nome);
      for (let dia = 1; dia <= dias; dia += 1) {
        const item = row.get(dia) || { status: "C", os: null, obs: null };
        upsertGradeItem(inspecaoId, eq, dia, item.status, item.os?.id || null, item.obs || null, 0);

        if (item.status === "NC" && item.os) {
          const dataOcorrencia = String(item.os.data_inicio || "").slice(0, 10);
          upsertNaoConformidade(inspecaoId, eq, dataOcorrencia, item.os, {
            nao_conformidade: item.os.causa || item.os.descricao || "Não conformidade detectada",
          });
        }
      }
    }
  });

  tx();
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

function buildMatrix(inspecaoId, ano, mes, equipamentos) {
  const diasMes = daysInMonth(ano, mes);
  const itens = db
    .prepare(
      `SELECT equipamento_nome, dia, status, os_id, observacao, is_manual
       FROM inspecao_pac01_itens
       WHERE inspecao_id = ?
       ORDER BY equipamento_nome, dia`
    )
    .all(inspecaoId);

  const byEquip = new Map();
  for (const eq of equipamentos) {
    byEquip.set(eq.nome, Array.from({ length: 31 }, (_, idx) => ({
      dia: idx + 1,
      status: idx + 1 <= diasMes ? "C" : "-",
      os_id: null,
      observacao: null,
      is_manual: 0,
    })));
  }

  for (const item of itens) {
    if (!byEquip.has(item.equipamento_nome)) continue;
    const arr = byEquip.get(item.equipamento_nome);
    arr[item.dia - 1] = {
      dia: item.dia,
      status: item.status,
      os_id: item.os_id,
      observacao: item.observacao,
      is_manual: item.is_manual,
    };
  }

  return byEquip;
}

function listNC(inspecaoId) {
  return db
    .prepare(
      `SELECT *
       FROM inspecao_pac01_nao_conformidades
       WHERE inspecao_id = ?
       ORDER BY data_ocorrencia DESC, equipamento_nome ASC`
    )
    .all(inspecaoId);
}

function updateGradeManual(inspecaoId, { equipamento_nome, dia, status, observacao, os_id }) {
  const equipamento = { id: null, nome: equipamento_nome };
  upsertGradeItem(inspecaoId, equipamento, Number(dia), status, os_id ? Number(os_id) : null, observacao || null, 1);
}

function saveNC(inspecaoId, payload) {
  const id = Number(payload.id || 0);
  if (!id) throw new Error("ID de NC inválido.");

  const nc = db
    .prepare("SELECT * FROM inspecao_pac01_nao_conformidades WHERE id = ? AND inspecao_id = ?")
    .get(id, inspecaoId);

  if (!nc) throw new Error("Não conformidade não encontrada.");

  db.prepare(
    `UPDATE inspecao_pac01_nao_conformidades
     SET acao_corretiva = ?,
         acao_preventiva = ?,
         data_correcao = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(payload.acao_corretiva || "").trim() || null,
    String(payload.acao_preventiva || "").trim() || null,
    payload.data_correcao || null,
    id
  );
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
  buildMatrix,
  listNC,
  updateGradeManual,
  saveNC,
  updateHeader,
};
