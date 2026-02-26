const db = require("../../database/db");
const { classifyOSPriority } = require("./os-priority.service");
const alertsHub = require("../alerts/alerts.hub");
const alertsService = require("../alerts/alerts.service");
const webPushService = require("../notifications/webpush.service");
let inspecaoService = null;
try {
  inspecaoService = require("../inspecao/inspecao.service");
} catch (_e) {}

function getOSColumns() {
  return db.prepare(`PRAGMA table_info(os)`).all().map((c) => c.name);
}

function tableExists(name) {
  try {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(String(name || ""));
    return !!row;
  } catch (_e) {
    return false;
  }
}

function getTableColumns(tableName) {
  try {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name);
  } catch (_e) {
    return [];
  }
}

function resolveAnexosTable() {
  if (tableExists("os_anexos")) return "os_anexos";
  if (tableExists("anexos")) return "anexos";
  return null;
}

function resolveGrauColumn(columns) {
  if (columns.includes("grau")) return "grau";
  if (columns.includes("grau_dificuldade")) return "grau_dificuldade";
  if (columns.includes("nivel_grau")) return "nivel_grau";
  return null;
}

function normalizeTipoOS(tipo) {
  const raw = String(tipo || "CORRETIVA").trim().toUpperCase();
  if (raw === "NR12") return "NRS";
  if (["CORRETIVA", "PREVENTIVA", "ELETRICA", "NRS", "OUTROS"].includes(raw)) return raw;
  return "OUTROS";
}

function normalizeGrau(grau) {
  const raw = String(grau || "MEDIA").trim().toUpperCase();
  if (["BAIXA", "MEDIA", "ALTA", "CRITICA"].includes(raw)) return raw;
  if (raw === "MÉDIA") return "MEDIA";
  if (raw === "CRÍTICA") return "CRITICA";
  return "MEDIA";
}

function listEquipamentosAtivos() {
  try {
    return db.prepare(`SELECT id, nome FROM equipamentos WHERE ativo = 1 ORDER BY nome`).all();
  } catch (_e) {
    return [];
  }
}

function listTipoOptions() {
  return ["CORRETIVA", "PREVENTIVA", "ELETRICA", "NRS", "OUTROS"];
}

function listGrauOptions() {
  return ["BAIXA", "MEDIA", "ALTA", "CRITICA"];
}

function listAnexos(osId, tipo) {
  try {
    const table = resolveAnexosTable();
    if (!table) return [];

    const t = String(tipo || "").toUpperCase();

    if (table === "os_anexos") {
      return db
        .prepare(
          `SELECT id, os_id, tipo, path, legenda, created_at
           FROM os_anexos
           WHERE os_id = ? AND tipo = ?
           ORDER BY id DESC`
        )
        .all(osId, t);
    }

    return db
      .prepare(
        `SELECT id,
                owner_id AS os_id,
                UPPER(CASE
                  WHEN filename LIKE '%fechamento%' THEN 'FECHAMENTO'
                  ELSE 'ABERTURA'
                END) AS tipo,
                filepath AS path,
                filename AS legenda,
                uploaded_at AS created_at
         FROM anexos
         WHERE owner_type = 'os' AND owner_id = ?
         ORDER BY id DESC`
      )
      .all(osId)
      .filter((row) => row.tipo === t);
  } catch (_e) {
    return [];
  }
}

function listPecasUtilizadas(osId) {
  try {
    return db
      .prepare(
        `SELECT id, os_id, peca_descricao, quantidade, created_at
         FROM os_pecas_utilizadas
         WHERE os_id = ?
         ORDER BY id`
      )
      .all(osId);
  } catch (_e) {
    return [];
  }
}

function getOSById(id) {
  const os = db
    .prepare(
      `SELECT *
       FROM os
       WHERE id = ?`
    )
    .get(id);

  if (!os) return null;

  return {
    ...os,
    fotos_abertura: listAnexos(id, "ABERTURA"),
    fotos_fechamento: listAnexos(id, "FECHAMENTO"),
    pecas_utilizadas: listPecasUtilizadas(id),
  };
}

function listOS() {
  const cols = getOSColumns();

  const grauColumn = resolveGrauColumn(cols);
  const grauExpr = grauColumn
    ? grauColumn
    : (cols.includes("prioridade") ? "prioridade" : "NULL");
  const openedExpr = cols.includes("opened_at")
    ? "opened_at"
    : (cols.includes("created_at") ? "created_at" : "NULL");
  const startedExpr = cols.includes("started_at")
    ? "started_at"
    : (cols.includes("data_inicio") ? "data_inicio" : "NULL");
  const closedExpr = cols.includes("closed_at")
    ? "closed_at"
    : (cols.includes("data_conclusao") ? "data_conclusao" : "NULL");

  return db
    .prepare(
      `SELECT o.id,
              o.equipamento,
              o.tipo,
              o.status,
              ${grauExpr} AS grau,
              ${openedExpr} AS opened_at,
              ${startedExpr} AS started_at,
              ${closedExpr} AS closed_at,
              COALESCE(u.name, u.email, '-') AS solicitante
       FROM os o
       LEFT JOIN users u ON u.id = o.opened_by
       ORDER BY o.id DESC
       LIMIT 300`
    )
    .all();
}

function emitOSEvents(osId, eventHint) {
  const payload = alertsService.buildEventoFromOS(osId);
  if (!payload) return;

  if (eventHint === "create") alertsHub.publish("os_criada", payload);
  alertsHub.publish("os_atualizada", payload);

  if (String(payload.prioridade || "").toUpperCase() === "EMERGENCIAL") {
    alertsHub.publish("nova_os_emergencial", payload);
  }

  if (eventHint === "status") {
    alertsHub.publish("os_status_alterado", payload);
    const st = String(payload.status || "").toUpperCase();
    if (st === "ANDAMENTO" || st === "EM_ANDAMENTO") alertsHub.publish("os_em_andamento", payload);
  }
}

function syncInspecaoFromOS(osId) {
  if (!inspecaoService?.syncFromOS) return;
  console.log("[INSPECAO_SYNC] syncFromOS disparado", { osId });
  try {
    const result = inspecaoService.syncFromOS(osId);
    if (result && result.synced === false) {
      if (result.reason === "os_or_data_missing") {
        console.warn("[INSPECAO_SYNC] syncFromOS sem data válida", { osId, reason: result.reason });
        return;
      }
      console.warn(`⚠️ [inspecao] syncFromOS não sincronizou OS #${osId}: ${result.reason || "motivo não informado"}`);
      return;
    }
    console.log("[INSPECAO_SYNC] syncFromOS concluído", { osId, result });
  } catch (err) {
    console.error("[INSPECAO_SYNC][ERROR]", err);
  }
}

function createOS({
  equipamento_id,
  equipamento_manual,
  descricao,
  resumo_tecnico,
  causa_diagnostico,
  data_inicio,
  data_fim,
  tipo,
  opened_by,
  grau,
}) {
  const desc = String(descricao || "").trim();
  if (!desc) throw new Error("Descrição obrigatória.");

  const openedBy = Number(opened_by || 0);
  if (!openedBy) throw new Error("Usuário logado obrigatório para abrir OS.");

  let equipId = equipamento_id ? Number(equipamento_id) : null;
  let equipManual = String(equipamento_manual || "").trim() || null;
  let equipamentoFinal = equipManual || "";

  if (equipId) {
    const eq = db.prepare(`SELECT nome FROM equipamentos WHERE id = ?`).get(equipId);
    if (eq?.nome) {
      equipamentoFinal = eq.nome;
      equipManual = null;
    } else {
      equipId = null;
    }
  }

  if (!equipamentoFinal) throw new Error("Informe um equipamento cadastrado ou manual.");

  const tipoOS = normalizeTipoOS(tipo);
  const grauOS = normalizeGrau(grau);
  const score = classifyOSPriority({ descricao: desc, tipo: tipoOS, equipamento_id: equipId });

  const cols = getOSColumns();
  const fields = ["equipamento", "descricao", "tipo", "status", "opened_by"];
  const values = [equipamentoFinal, desc, tipoOS, "ABERTA", openedBy];

  if (cols.includes("equipamento_id")) {
    fields.push("equipamento_id");
    values.push(equipId);
  }
  if (cols.includes("equipamento_manual")) {
    fields.push("equipamento_manual");
    values.push(equipManual);
  }

  if (cols.includes("resumo_tecnico")) {
    fields.push("resumo_tecnico");
    values.push(String(resumo_tecnico || "").trim() || null);
  } else if (cols.includes("acao_executada")) {
    fields.push("acao_executada");
    values.push(String(resumo_tecnico || "").trim() || null);
  }

  if (cols.includes("causa_diagnostico")) {
    fields.push("causa_diagnostico");
    values.push(String(causa_diagnostico || "").trim() || null);
  } else if (cols.includes("diagnostico")) {
    fields.push("diagnostico");
    values.push(String(causa_diagnostico || "").trim() || null);
  }

  if (cols.includes("data_inicio")) {
    fields.push("data_inicio");
    values.push(String(data_inicio || "").trim() || null);
  }
  if (cols.includes("data_fim")) {
    fields.push("data_fim");
    values.push(String(data_fim || "").trim() || null);
  }

  const grauColumn = resolveGrauColumn(cols);
  if (grauColumn) {
    fields.push(grauColumn);
    values.push(grauOS);
  }

  if (cols.includes("prioridade")) {
    fields.push("prioridade");
    values.push(score.prioridade || "MEDIA");
  }
  if (cols.includes("categoria_sugerida")) {
    fields.push("categoria_sugerida");
    values.push(score.categoria_sugerida || null);
  }
  if (cols.includes("alertar_imediatamente")) {
    fields.push("alertar_imediatamente");
    values.push(score.alertar_imediatamente ? 1 : 0);
  }

  const stmt = db.prepare(
    `INSERT INTO os (${fields.join(",")})
     VALUES (${fields.map(() => "?").join(",")})`
  );

  const info = stmt.run(...values);
  const osId = Number(info.lastInsertRowid);

  emitOSEvents(osId, "create");
  syncInspecaoFromOS(osId);

  webPushService
    .sendOSPushNotifications({
      osId,
      equipamento: equipamentoFinal,
      grau: grauOS,
      descricao: desc,
    })
    .catch(() => {});

  return osId;
}

function addFotosAberturaFechamento({ osId, files = [], tipo, userId }) {
  if (!osId) return;
  const t = String(tipo || "").toUpperCase();
  if (!["ABERTURA", "FECHAMENTO"].includes(t)) return;

  const table = resolveAnexosTable();
  if (!table) return;

  const tx = db.transaction(() => {
    if (table === "os_anexos") {
      const insert = db.prepare(
        `INSERT INTO os_anexos (os_id, tipo, path, legenda, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      );

      for (const f of files || []) {
        const pathPublic = f.pathPublic || f.path || null;
        if (!pathPublic) continue;
        insert.run(osId, t, pathPublic, null, userId || null);
      }
      return;
    }

    const anexosCols = getTableColumns("anexos");
    const hasUploadedBy = anexosCols.includes("uploaded_by");

    const insertLegacy = hasUploadedBy
      ? db.prepare(
          `INSERT INTO anexos (owner_type, owner_id, filename, filepath, uploaded_by, uploaded_at)
           VALUES ('os', ?, ?, ?, ?, datetime('now'))`
        )
      : db.prepare(
          `INSERT INTO anexos (owner_type, owner_id, filename, filepath, uploaded_at)
           VALUES ('os', ?, ?, ?, datetime('now'))`
        );

    for (const f of files || []) {
      const pathPublic = f.pathPublic || f.path || null;
      if (!pathPublic) continue;
      const filename = `${t.toLowerCase()}-${f.originalname || 'foto'}`;

      if (hasUploadedBy) insertLegacy.run(osId, filename, pathPublic, userId || null);
      else insertLegacy.run(osId, filename, pathPublic);
    }
  });
  tx();
}

function iniciarOS(id, userId) {
  const os = getOSById(id);
  if (!os) throw new Error("OS não encontrada.");

  const cols = getOSColumns();
  const sets = ["status = 'ANDAMENTO'"];
  const args = [];

  if (cols.includes("started_at")) {
    sets.push("started_at = COALESCE(started_at, datetime('now'))");
  }
  if (cols.includes("started_by")) {
    sets.push("started_by = COALESCE(started_by, ?)");
    args.push(userId || null);
  }
  if (cols.includes("data_inicio")) {
    sets.push("data_inicio = COALESCE(data_inicio, datetime('now'))");
  }

  args.push(id);
  db.prepare(`UPDATE os SET ${sets.join(", ")} WHERE id = ?`).run(...args);

  emitOSEvents(id, "status");
  if (inspecaoService?.syncFromOS) {
    try {
      inspecaoService.syncFromOS(id);
    } catch (_e) {}
  }
}

function pausarOS(id) {
  const os = getOSById(id);
  if (!os) throw new Error("OS não encontrada.");

  db.prepare(`UPDATE os SET status = 'PAUSADA' WHERE id = ?`).run(id);
  emitOSEvents(id, "status");
  if (inspecaoService?.syncFromOS) {
    try {
      inspecaoService.syncFromOS(id);
    } catch (_e) {}
  }
}

function concluirOS(id, { closedBy, diagnostico, acaoExecutada, pecas, dataFim }) {
  const os = getOSById(id);
  if (!os) throw new Error("OS não encontrada.");
  console.log("[OS_CLOSE] concluirOS:start", {
    osId: id,
    status_atual: os.status,
    tipo: os.tipo,
    data_inicio: os.data_inicio || os.opened_at || null,
    data_fim_atual: os.data_fim || os.data_conclusao || os.closed_at || null,
  });

  const diag = String(diagnostico || "").trim() || null;
  const acao = String(acaoExecutada || "").trim() || null;

  const cols = getOSColumns();

  const tx = db.transaction(() => {
    const sets = ["status = 'FECHADA'", "closed_at = datetime('now')", "closed_by = ?"];
    const args = [closedBy || null];

    if (cols.includes("data_conclusao")) sets.push("data_conclusao = COALESCE(data_conclusao, datetime('now'))");
    if (cols.includes("diagnostico")) {
      sets.push("diagnostico = ?");
      args.push(diag);
    }
    if (cols.includes("causa_diagnostico")) {
      sets.push("causa_diagnostico = COALESCE(?, causa_diagnostico)");
      args.push(diag);
    }
    if (cols.includes("acao_executada")) {
      sets.push("acao_executada = COALESCE(?, acao_executada)");
      args.push(acao);
    }
    if (cols.includes("resumo_tecnico")) {
      sets.push("resumo_tecnico = COALESCE(?, resumo_tecnico)");
      args.push(acao);
    }
    if (cols.includes("data_fim")) {
      sets.push("data_fim = COALESCE(?, data_fim)");
      args.push(String(dataFim || "").trim() || null);
    }

    args.push(id);
    db.prepare(`UPDATE os SET ${sets.join(", ")} WHERE id = ?`).run(...args);

    if (Array.isArray(pecas) && pecas.length) {
      const ins = db.prepare(
        `INSERT INTO os_pecas_utilizadas (os_id, peca_descricao, quantidade, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      );
      for (const p of pecas) {
        const d = String(p.peca_descricao || "").trim();
        if (!d) continue;
        const q = Number(p.quantidade || 1);
        ins.run(id, d, q);
      }
    }
  });

  tx();
  emitOSEvents(id, "status");
  let syncResult = null;
  if (inspecaoService?.syncFromClosedOS) {
    try {
      console.log("[INSPECAO_SYNC] syncFromClosedOS disparado", { osId: id });
      syncResult = inspecaoService.syncFromClosedOS(id);
      console.log("[INSPECAO_SYNC] syncFromClosedOS retorno", { osId: id, syncResult });
    } catch (err) {
      console.error("[INSPECAO_SYNC][ERROR]", err);
    }
  } else if (inspecaoService?.syncFromOS) {
    try {
      console.log("[INSPECAO_SYNC] fallback syncFromOS disparado", { osId: id });
      syncResult = inspecaoService.syncFromOS(id);
      console.log("[INSPECAO_SYNC] fallback syncFromOS retorno", { osId: id, syncResult });
    } catch (err) {
      console.error("[INSPECAO_SYNC][ERROR]", err);
    }
  }
  return syncResult;
}

function updateStatus(id, status) {
  const st = String(status || "").trim().toUpperCase();
  if (!st) return;

  db.prepare(`UPDATE os SET status = ? WHERE id = ?`).run(st, id);
  emitOSEvents(id, "status");
  if (inspecaoService?.syncFromOS) {
    try {
      inspecaoService.syncFromOS(id);
    } catch (_e) {}
  }
}

module.exports = {
  listOS,
  listEquipamentosAtivos,
  listTipoOptions,
  listGrauOptions,
  createOS,
  addFotosAberturaFechamento,
  getOSById,
  iniciarOS,
  pausarOS,
  concluirOS,
  updateStatus,
};
