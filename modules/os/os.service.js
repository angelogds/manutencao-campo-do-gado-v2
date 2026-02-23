const db = require("../../database/db");
const { classifyOSPriority } = require("./os-priority.service");
const alertsHub = require("../alerts/alerts.hub");
const alertsService = require("../alerts/alerts.service");
const webPushService = require("../notifications/webpush.service");

function getOSColumns() {
  return db.prepare(`PRAGMA table_info(os)`).all().map((c) => c.name);
}

function hasLegacyUsersOldFK() {
  try {
    const fks = db.prepare(`PRAGMA foreign_key_list(os)`).all();
    return fks.some((fk) => String(fk.table || "").toLowerCase() === "users_old");
  } catch (_e) {
    return false;
  }
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
  if (["CORRETIVA", "PREVENTIVA", "NRS", "OUTROS"].includes(raw)) return raw;
  return "OUTROS";
}

function normalizeGrau(grau) {
  const raw = String(grau || "MEDIA").trim().toUpperCase();
  if (["BAIXA", "MEDIA", "ALTA", "CRITICA"].includes(raw)) return raw;
  if (raw === "MÉDIA") return "MEDIA";
  if (raw === "CRÍTICA") return "CRITICA";
  return "MEDIA";
}

function listGrauOptions() {
  return ["BAIXA", "MEDIA", "ALTA", "CRITICA"];
}

function listTipoOptions() {
  return ["CORRETIVA", "PREVENTIVA", "NRS", "OUTROS"];
}

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

function listOS() {
  const grauExpr = resolveGrauColumn(getOSColumns())
    ? `COALESCE(o.${resolveGrauColumn(getOSColumns())}, '-')`
    : "COALESCE(o.prioridade, '-')";

  return db
    .prepare(
      `SELECT o.id,
              COALESCE(e.nome, o.equipamento_manual, o.equipamento) AS equipamento,
              o.descricao,
              o.tipo,
              o.status,
              ${grauExpr} AS grau,
              o.opened_at,
              COALESCE(u.name, '-') AS solicitante
       FROM os o
       LEFT JOIN equipamentos e ON e.id = o.equipamento_id
       LEFT JOIN users u ON u.id = o.opened_by
       ORDER BY o.id DESC
       LIMIT 200`
    )
    .all();
}

function listAnexos(osId, tipo = "ABERTURA") {
  return db
    .prepare(
      `SELECT id, filename, filepath, uploaded_at
       FROM anexos
       WHERE owner_type = ? AND owner_id = ?
       ORDER BY id DESC`
    )
    .all(`os_${String(tipo || "ABERTURA").toLowerCase()}`, Number(osId));
}

function listPecasUtilizadas(osId) {
  try {
    return db
      .prepare(
        `SELECT id, peca_descricao, quantidade
         FROM os_pecas_utilizadas
         WHERE os_id = ?
         ORDER BY id DESC`
      )
      .all(Number(osId));
  } catch (_e) {
    return [];
  }
}

function getOSById(id) {
  const cols = getOSColumns();
  const grauColumn = resolveGrauColumn(cols);
  const grauExpr = grauColumn ? `COALESCE(o.${grauColumn}, '-')` : "COALESCE(o.prioridade,'-')";

  const os = db
    .prepare(
      `SELECT o.*, ${grauExpr} AS grau,
              COALESCE(e.nome, o.equipamento_manual, o.equipamento) AS equipamento_resolvido,
              COALESCE(e.codigo, '-') AS equipamento_codigo,
              COALESCE(uo.name, '-') AS solicitante_nome,
              COALESCE(uc.name, '-') AS fechada_por_nome,
              COALESCE(ux.name, '-') AS mecanico_andamento_nome,
              ex.iniciado_em AS execucao_iniciada_em
       FROM os o
       LEFT JOIN equipamentos e ON e.id = o.equipamento_id
       LEFT JOIN users uo ON uo.id = o.opened_by
       LEFT JOIN users uc ON uc.id = o.closed_by
       LEFT JOIN os_execucoes ex ON ex.os_id = o.id AND ex.finalizado_em IS NULL
       LEFT JOIN users ux ON ux.id = ex.mecanico_user_id
       WHERE o.id = ?
       LIMIT 1`
    )
    .get(Number(id));

  if (!os) return null;

  return {
    ...os,
    fotos_abertura: listAnexos(id, "ABERTURA"),
    fotos_fechamento: listAnexos(id, "FECHAMENTO"),
    pecas_utilizadas: listPecasUtilizadas(id),
  };
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
    if (
      String(payload.status || "").toUpperCase() === "ANDAMENTO" ||
      String(payload.status || "").toUpperCase() === "EM_ANDAMENTO"
    ) {
      alertsHub.publish("os_em_andamento", payload);
    }
  }
}

function createOS({ equipamento_id, equipamento_manual, descricao, tipo, opened_by, grau }) {
  const desc = String(descricao || "").trim();
  if (!desc) throw new Error("Descrição obrigatória.");

  const openedByRequested = Number(opened_by || 0) || null;
  const openedBy = hasLegacyUsersOldFK() ? null : openedByRequested;

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

  const stmt = db.prepare(`INSERT INTO os (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`);
  const info = stmt.run(...values);
  const osId = Number(info.lastInsertRowid);

  emitOSEvents(osId, "create");

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

function addFotosAberturaFechamento({ osId, files = [], tipo = "ABERTURA", userId = null }) {
  if (!Array.isArray(files) || files.length === 0) return;

  const ownerType = `os_${String(tipo || "ABERTURA").toLowerCase()}`;
  const stmt = db.prepare(
    `INSERT INTO anexos (owner_type, owner_id, filename, filepath, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  );

  const safeUser = hasLegacyUsersOldFK() ? null : Number(userId || 0) || null;

  const tx = db.transaction((rows) => {
    rows.forEach((file) => {
      stmt.run(ownerType, Number(osId), file.originalname, file.pathPublic, safeUser);
    });
  });

  tx(files);
}

function ensureStatus(os, expected) {
  if (!os) throw new Error("OS não encontrada.");
  const st = String(os.status || "").toUpperCase();
  if (!expected.includes(st)) {
    throw new Error(`Status atual não permite esta ação (${st}).`);
  }
}

function iniciarOS(osId, mecanicoId) {
  const os = getOSById(osId);
  ensureStatus(os, ["ABERTA", "PAUSADA"]);

  db.prepare(`UPDATE os SET status='ANDAMENTO', data_inicio=COALESCE(data_inicio, datetime('now')) WHERE id=?`).run(Number(osId));

  const existing = db
    .prepare(`SELECT id FROM os_execucoes WHERE os_id=? AND finalizado_em IS NULL ORDER BY id DESC LIMIT 1`)
    .get(Number(osId));

  if (!existing) {
    db.prepare(`INSERT INTO os_execucoes (os_id, mecanico_user_id, iniciado_em) VALUES (?, ?, datetime('now'))`).run(
      Number(osId),
      Number(mecanicoId)
    );
  }

  emitOSEvents(Number(osId), "status");
}

function pausarOS(osId) {
  const os = getOSById(osId);
  ensureStatus(os, ["ANDAMENTO", "EM_ANDAMENTO"]);

  db.prepare(`UPDATE os SET status='PAUSADA' WHERE id=?`).run(Number(osId));
  db.prepare(`UPDATE os_execucoes SET finalizado_em=datetime('now') WHERE os_id=? AND finalizado_em IS NULL`).run(Number(osId));
  // TODO: quando houver regra de tempo com pausas, calcular e acumular duração líquida aqui.
  emitOSEvents(Number(osId), "status");
}

function concluirOS(osId, { closedBy, diagnostico, acaoExecutada, pecas = [] }) {
  const os = getOSById(osId);
  ensureStatus(os, ["ANDAMENTO", "EM_ANDAMENTO", "PAUSADA"]);

  const diag = String(diagnostico || "").trim();
  const acao = String(acaoExecutada || "").trim();
  if (!diag) throw new Error("Diagnóstico/causa é obrigatório.");
  if (!acao) throw new Error("Campo 'O que foi feito' é obrigatório.");

  const fotosFechamento = listAnexos(osId, "FECHAMENTO");
  if (!fotosFechamento.length) throw new Error("Adicione ao menos 1 foto de fechamento.");

  db.prepare(
    `UPDATE os
     SET status='CONCLUIDA',
         diagnostico=?,
         acao_executada=?,
         data_conclusao=datetime('now'),
         closed_at=datetime('now'),
         closed_by=?
     WHERE id=?`
  ).run(diag, acao, hasLegacyUsersOldFK() ? null : Number(closedBy || 0) || null, Number(osId));

  db.prepare(`UPDATE os_execucoes SET finalizado_em=datetime('now') WHERE os_id=? AND finalizado_em IS NULL`).run(Number(osId));

  try {
    db.prepare(`DELETE FROM os_pecas_utilizadas WHERE os_id=?`).run(Number(osId));
    const ins = db.prepare(`INSERT INTO os_pecas_utilizadas (os_id, peca_descricao, quantidade) VALUES (?, ?, ?)`);
    pecas.forEach((p) => {
      const descricao = String(p.peca_descricao || "").trim();
      const qtd = Number(p.quantidade || 0);
      if (descricao && qtd > 0) ins.run(Number(osId), descricao, qtd);
    });
  } catch (_e) {}

  emitOSEvents(Number(osId), "status");
}

function updateStatus(id, status, userId) {
  let st = (status || "").trim().toUpperCase();
  if (st === "EM_ANDAMENTO") st = "ANDAMENTO";
  if (st === "ANDAMENTO") return iniciarOS(id, userId);
  if (st === "PAUSADA") return pausarOS(id);

  const allowed = ["ABERTA", "CONCLUIDA", "CANCELADA"];
  if (!allowed.includes(st)) throw new Error("Status inválido.");

  if (st === "CONCLUIDA") {
    db.prepare(`UPDATE os SET status='CONCLUIDA', closed_by=?, closed_at=datetime('now') WHERE id=?`).run(
      hasLegacyUsersOldFK() ? null : Number(userId || 0) || null,
      Number(id)
    );
  } else {
    db.prepare(`UPDATE os SET status=? WHERE id=?`).run(st, Number(id));
  }

  emitOSEvents(Number(id), "status");
}

module.exports = {
  listEquipamentosAtivos,
  listGrauOptions,
  listTipoOptions,
  listOS,
  getOSById,
  createOS,
  addFotosAberturaFechamento,
  iniciarOS,
  pausarOS,
  concluirOS,
  updateStatus,
};
