// modules/os/os.service.js
const db = require("../../database/db");
const { classifyOSPriority } = require('./os-priority.service');
const alertsHub = require('../alerts/alerts.hub');
const alertsService = require('../alerts/alerts.service');
const webPushService = require('../notifications/webpush.service');

function getOSColumns() {
  return db.prepare(`PRAGMA table_info(os)`).all().map(c => c.name);
}

function hasOSColumn(name) {
  return getOSColumns().includes(name);
}


function hasLegacyUsersOldFK() {
  try {
    const fks = db.prepare(`PRAGMA foreign_key_list(os)`).all();
    return fks.some((fk) => String(fk.table || '').toLowerCase() === 'users_old');
  } catch (_e) {
    return false;
  }
}


function resolveGrauColumn(columns) {
  if (columns.includes('grau')) return 'grau';
  if (columns.includes('grau_dificuldade')) return 'grau_dificuldade';
  if (columns.includes('nivel_grau')) return 'nivel_grau';
  return null;
}

function upsertExecucaoAndamento(osId, userId) {
  if (!osId || !userId) return;
  try {
    const existing = db.prepare(`SELECT id FROM os_execucoes WHERE os_id=? AND finalizado_em IS NULL ORDER BY id DESC LIMIT 1`).get(Number(osId));
    if (!existing) {
      db.prepare(`INSERT INTO os_execucoes (os_id, mecanico_user_id, iniciado_em) VALUES (?, ?, datetime('now'))`)
        .run(Number(osId), Number(userId));
    }
  } catch (_e) {
    // TODO: integrar com módulo oficial de apontamento de horas, caso exista tabela própria.
  }
}

function finalizarExecucao(osId) {
  try {
    db.prepare(`UPDATE os_execucoes SET finalizado_em=datetime('now') WHERE os_id=? AND finalizado_em IS NULL`)
      .run(Number(osId));
  } catch (_e) {}
}


function listGrauOptions() {
  const cols = getOSColumns();
  const grauColumn = resolveGrauColumn(cols);
  if (!grauColumn) return ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'];
  try {
    const rows = db.prepare(`SELECT DISTINCT UPPER(COALESCE(${grauColumn},'')) AS v FROM os WHERE ${grauColumn} IS NOT NULL AND TRIM(${grauColumn}) <> '' LIMIT 20`).all();
    const vals = rows.map((r) => r.v).filter(Boolean);
    return vals.length ? vals : ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'];
  } catch (_e) {
    return ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'];
  }
}

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
      `SELECT id, equipamento, descricao, tipo, status, COALESCE(prioridade,'MEDIA') AS prioridade, opened_at
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

function emitOSEvents(osId, eventHint) {
  const payload = alertsService.buildEventoFromOS(osId);
  if (!payload) return;

  if (eventHint === 'create') alertsHub.publish('os_criada', payload);
  alertsHub.publish('os_atualizada', payload);

  if (String(payload.prioridade || '').toUpperCase() === 'EMERGENCIAL') {
    alertsHub.publish('nova_os_emergencial', payload);
  }

  if (eventHint === 'status') {
    alertsHub.publish('os_status_alterado', payload);
    if (String(payload.status || '').toUpperCase() === 'ANDAMENTO' || String(payload.status || '').toUpperCase() === 'EM_ANDAMENTO') {
      alertsHub.publish('os_em_andamento', payload);
    }
  }
}

// Cria OS
function createOS({ equipamento_id, equipamento_texto, descricao, tipo, opened_by, grau }) {
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
      equipId = null;
    }
  }

  if (!equipamentoFinal) {
    throw new Error("Informe um equipamento (cadastro ou manual).");
  }

  const t = (tipo || "CORRETIVA").trim().toUpperCase();
  const score = classifyOSPriority({ descricao: desc, tipo: t, equipamento_id: equipId });

  const cols = getOSColumns();
  const hasEquipId = cols.includes("equipamento_id");
  const hasPrioridade = cols.includes('prioridade');
  const hasCategoria = cols.includes('categoria_sugerida');
  const hasAlert = cols.includes('alertar_imediatamente');
  const grauColumn = resolveGrauColumn(cols);

  const openedBySafe = hasLegacyUsersOldFK() ? null : (opened_by || null);

  const fields = ['equipamento', 'descricao', 'tipo', 'status', 'opened_by'];
  const values = [equipamentoFinal, desc, t, 'ABERTA', openedBySafe];

  if (hasEquipId) {
    fields.splice(1, 0, 'equipamento_id');
    values.splice(1, 0, equipId);
  }

  if (hasPrioridade) {
    fields.push('prioridade');
    values.push(score.prioridade);
  }
  if (hasCategoria) {
    fields.push('categoria_sugerida');
    values.push(score.categoria_sugerida);
  }
  if (hasAlert) {
    fields.push('alertar_imediatamente');
    values.push(score.alertar_imediatamente ? 1 : 0);
  }
  if (grauColumn && grau) {
    // TODO: usar apenas o campo de grau oficial da OS. Esta rotina detecta automaticamente o nome da coluna.
    fields.push(grauColumn);
    values.push(String(grau).toUpperCase());
  }

  const insertPlaceholders = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT INTO os (${fields.join(', ')}) VALUES (${insertPlaceholders})`);
  const info = stmt.run(...values);

  const osId = Number(info.lastInsertRowid);

  if ((!hasPrioridade || !hasCategoria || !hasAlert) && hasPrioridade) {
    db.prepare(`UPDATE os SET prioridade=?, categoria_sugerida=?, alertar_imediatamente=? WHERE id=?`)
      .run(score.prioridade, score.categoria_sugerida, score.alertar_imediatamente ? 1 : 0, osId);
  }

  emitOSEvents(osId, 'create');
  const os = getOSById(osId) || {};
  webPushService.sendOSPushNotifications({ osId, equipamento: os.equipamento || equipamentoFinal, grau: os.grau || os.grau_dificuldade || os.nivel_grau || score.prioridade, descricao: os.descricao || desc })
    .catch(() => {});
  return osId;
}

// Atualiza status
function updateStatus(id, status, closed_by) {
  let st = (status || "").trim().toUpperCase();
  if (st === 'EM_ANDAMENTO') st = 'ANDAMENTO';
  const allowed = ["ABERTA", "ANDAMENTO", "PAUSADA", "CONCLUIDA", "CANCELADA"];
  if (!allowed.includes(st)) throw new Error("Status inválido.");

  if (st === "CONCLUIDA" || st === "CANCELADA") {
    db.prepare(
      `UPDATE os
       SET status = ?, closed_by = ?, closed_at = datetime('now')
       WHERE id = ?`
).run(st, hasLegacyUsersOldFK() ? null : (closed_by || null), id);
    finalizarExecucao(id);
    emitOSEvents(id, 'status');
    return;
  }

  db.prepare(
    `UPDATE os
     SET status = ?
     WHERE id = ?`
  ).run(st, id);

  if (st === 'ANDAMENTO') upsertExecucaoAndamento(id, closed_by);
  if (st === 'PAUSADA') finalizarExecucao(id);

  emitOSEvents(id, 'status');
}

module.exports = {
  listEquipamentosAtivos,
  listGrauOptions,
  listOS,
  getOSById,
  createOS,
  updateStatus,
};
