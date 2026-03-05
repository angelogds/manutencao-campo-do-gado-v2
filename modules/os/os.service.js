const db = require("../../database/db");
const { classifyOSPriority } = require("./os-priority.service");
const alertsHub = require("../alerts/alerts.hub");
const alertsService = require("../alerts/alerts.service");
const pushService = require("../push/push.service");
const escalaService = require("../escala/escala.service");
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

function listAlocacoesEquipe(osId) {
  if (!tableExists("os_alocacoes")) return [];
  const cols = getTableColumns("os_alocacoes");
  if (cols.includes("mecanico_user_id") && cols.includes("auxiliar_user_id")) {
    return db
      .prepare(
        `SELECT oa.id,
                oa.os_id,
                oa.alocado_em AS created_at,
                m.id AS mecanico_user_id,
                m.name AS mecanico_nome,
                a.id AS auxiliar_user_id,
                a.name AS auxiliar_nome
         FROM os_alocacoes oa
         JOIN users m ON m.id = oa.mecanico_user_id
         JOIN users a ON a.id = oa.auxiliar_user_id
         WHERE oa.os_id = ?
         ORDER BY oa.id DESC`
      )
      .all(osId);
  }

  return db
    .prepare(
      `SELECT oa.id,
              oa.os_id,
              oa.user_id,
              oa.papel,
              oa.created_at,
              u.name,
              UPPER(COALESCE(NULLIF(${getTableColumns('users').includes('funcao') ? 'u.funcao' : "''"}, ''), CASE WHEN UPPER(u.role)='MECANICO' THEN 'MECANICO' ELSE 'AUXILIAR' END)) AS funcao
       FROM os_alocacoes oa
       JOIN users u ON u.id = oa.user_id
       WHERE oa.os_id = ?
       ORDER BY CASE oa.papel WHEN 'RESPONSAVEL' THEN 0 ELSE 1 END, oa.id ASC`
    )
    .all(osId);
}


function getExecucaoAtiva(osId) {
  if (!tableExists("os_execucoes")) return null;
  const execCols = getTableColumns("os_execucoes");
  const executorCol = execCols.includes("executor_user_id") ? "executor_user_id" : "mecanico_user_id";
  return db.prepare(`
    SELECT ex.*, u.name AS executor_nome, ua.name AS auxiliar_nome
    FROM os_execucoes ex
    LEFT JOIN users u ON u.id = ex.${executorCol}
    LEFT JOIN users ua ON ua.id = ex.auxiliar_user_id
    WHERE ex.os_id = ? AND ex.finalizado_em IS NULL
    ORDER BY ex.id DESC
    LIMIT 1
  `).get(Number(osId));
}

function isOcupado(userId) {
  if (!userId || !tableExists("os_execucoes")) return false;
  const execCols = getTableColumns("os_execucoes");
  const executorCol = execCols.includes("executor_user_id") ? "executor_user_id" : "mecanico_user_id";
  const row = db.prepare(`
    SELECT 1
    FROM os_execucoes
    WHERE finalizado_em IS NULL
      AND (${executorCol} = ? OR auxiliar_user_id = ?)
    LIMIT 1
  `).get(Number(userId), Number(userId));
  return !!row;
}

function getDisponiveis(turnoUsers, funcao, { considerarOcupacao = true } = {}) {
  return (turnoUsers || [])
    .filter((u) => {
      if (!funcao) return true;
      return String(u.funcao || "").toLowerCase() === String(funcao || "").toLowerCase();
    })
    .filter((u) => (considerarOcupacao ? !isOcupado(u.id) : true));
}

function getParesAtivosDisponiveis(turnoUsers) {
  if (!tableExists("os_pares_equipes")) return [];
  const userIdsTurno = new Set((turnoUsers || []).map((u) => Number(u.id)));
  const pares = db.prepare(`
    SELECT p.mecanico_user_id, p.auxiliar_user_id, m.name AS mecanico_nome, a.name AS auxiliar_nome
    FROM os_pares_equipes p
    JOIN users m ON m.id = p.mecanico_user_id
    JOIN users a ON a.id = p.auxiliar_user_id
    WHERE IFNULL(p.ativo,1) = 1
    ORDER BY m.name ASC
  `).all();

  return pares.filter((p) =>
    userIdsTurno.has(Number(p.mecanico_user_id))
    && userIdsTurno.has(Number(p.auxiliar_user_id))
    && !isOcupado(p.mecanico_user_id)
    && !isOcupado(p.auxiliar_user_id)
  );
}

function pickNextMecanicoRoundRobin(listaMecanicosDisponiveis) {
  const ordenados = [...(listaMecanicosDisponiveis || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  if (!ordenados.length) return null;
  const ultimoMecanicoId = Number(getConfig("ultimo_mecanico_id") || 0) || null;
  const idx = ultimoMecanicoId ? ordenados.findIndex((m) => Number(m.id) === ultimoMecanicoId) : -1;
  const escolhido = idx >= 0 ? (ordenados[idx + 1] || ordenados[0]) : ordenados[0];
  setConfig("ultimo_mecanico_id", Number(escolhido.id));
  return escolhido;
}

function createExecucao(osId, executorUserId, auxiliarUserId, alocadoPorUserId, observacao = null, turnoAlocacao = null) {
  const cols = tableExists("os_execucoes") ? getTableColumns("os_execucoes") : [];
  const executorCol = cols.includes("executor_user_id") ? "executor_user_id" : "mecanico_user_id";
  const hasAux = cols.includes("auxiliar_user_id");
  const hasAlocadoPor = cols.includes("alocado_por");
  const hasObs = cols.includes("observacao");
  const hasTurno = cols.includes("turno_alocacao");
  const fields = ["os_id", executorCol, "iniciado_em"];
  const placeholders = ["?", "?", "datetime('now')"];
  const args = [Number(osId), Number(executorUserId)];

  if (hasAux) {
    fields.push("auxiliar_user_id");
    placeholders.push("?");
    args.push(auxiliarUserId ? Number(auxiliarUserId) : null);
  }
  if (hasAlocadoPor) {
    fields.push("alocado_por");
    placeholders.push("?");
    args.push(alocadoPorUserId ? Number(alocadoPorUserId) : null);
  }
  if (hasObs) {
    fields.push("observacao");
    placeholders.push("?");
    args.push(observacao || null);
  }
  if (hasTurno) {
    fields.push("turno_alocacao");
    placeholders.push("?");
    args.push(turnoAlocacao || null);
  }

  db.prepare(`INSERT INTO os_execucoes (${fields.join(",")}) VALUES (${placeholders.join(",")})`).run(...args);
}

function prioritizeMecanicos(mecanicosDisponiveis = []) {
  const prioridade = ["Diogo", "Salviano", "Rodolfo", "Fábio"];
  const normalized = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const pos = (nome) => {
    const idx = prioridade.findIndex((ref) => normalized(nome).includes(normalized(ref)));
    return idx < 0 ? 99 : idx;
  };
  return [...mecanicosDisponiveis].sort((a, b) => {
    const pa = pos(a.name);
    const pb = pos(b.name);
    if (pa !== pb) return pa - pb;
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });
}


function listUsuariosEquipe() {
  const turnoAtual = escalaService.getTurnoAtual?.() || "DIA";
  const usersDoTurno = escalaService.getUsersDoTurno?.(turnoAtual) || [];
  return usersDoTurno
    .map((u) => ({
      id: Number(u.id || u.user_id),
      name: u.name || u.nome,
      funcao: String(u.funcao || "").toLowerCase(),
    }))
    .filter((u) => u.id && u.name)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
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

  const mecanicoNome = os.mecanico_user_id
    ? db.prepare(`SELECT name FROM users WHERE id = ?`).get(os.mecanico_user_id)?.name
    : null;
  const auxiliarNome = os.auxiliar_user_id
    ? db.prepare(`SELECT name FROM users WHERE id = ?`).get(os.auxiliar_user_id)?.name
    : null;

  return {
    ...os,
    mecanico_nome: mecanicoNome,
    auxiliar_nome: auxiliarNome,
    fotos_abertura: listAnexos(id, "ABERTURA"),
    fotos_fechamento: listAnexos(id, "FECHAMENTO"),
    pecas_utilizadas: listPecasUtilizadas(id),
    alocacoes_equipe: listAlocacoesEquipe(id),
    execucao_ativa: getExecucaoAtiva(id),
  };
}

function getConfig(chave) {
  if (!tableExists("config_sistema")) return null;
  return db.prepare(`SELECT valor FROM config_sistema WHERE chave = ?`).get(chave)?.valor || null;
}

function setConfig(chave, valor) {
  if (!tableExists("config_sistema")) return;
  db.prepare(`
    INSERT INTO config_sistema (chave, valor)
    VALUES (?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor
  `).run(chave, valor == null ? null : String(valor));
}

function rotateByLastId(disponiveis, lastId) {
  if (!disponiveis.length || !lastId) return disponiveis;
  const idx = disponiveis.findIndex((m) => Number(m.id) === Number(lastId));
  if (idx < 0) return disponiveis;
  return disponiveis.slice(idx + 1).concat(disponiveis.slice(0, idx + 1));
}

function autoAssignEquipe(osId, alocadoPorUserId) {
  const os = db.prepare(`SELECT id, grau, status FROM os WHERE id = ?`).get(Number(osId));
  if (!os) throw new Error("OS não encontrada.");

  const grau = normalizeGrau(os.grau);
  const turnoAtual = typeof escalaService.getTurnoAtual === "function"
    ? escalaService.getTurnoAtual()
    : "DIA";
  const emAndamentoStatus = "EM_ANDAMENTO";

  if (turnoAtual === "NOITE") {
    const plantonistaId = escalaService.getPlantonistaDoDia?.("NOITE") || escalaService.getPlantonistaNoturno?.();
    if (!plantonistaId) {
      db.prepare(`UPDATE os SET status = 'AGUARDANDO_EQUIPE' WHERE id = ?`).run(Number(osId));
      return { aguardando: true, aviso: "Sem mecânico plantonista no turno noturno." };
    }

    const usersNoite = escalaService.getUsersDoTurno?.("NOITE") || [];
    const auxiliarNoite = getDisponiveis(usersNoite, "auxiliar", { considerarOcupacao: false })
      .find((u) => Number(u.id) !== Number(plantonistaId)) || null;
    const executor = usersNoite.find((u) => Number(u.id) === Number(plantonistaId))
      || db.prepare(`SELECT id, name FROM users WHERE id = ?`).get(Number(plantonistaId));

    db.transaction(() => {
      db.prepare(`UPDATE os_execucoes SET finalizado_em = datetime('now') WHERE os_id = ? AND finalizado_em IS NULL`).run(Number(osId));
      createExecucao(osId, Number(plantonistaId), auxiliarNoite?.id || null, alocadoPorUserId, null, "NOITE");
      db.prepare(`UPDATE os SET status = ?, mecanico_user_id = ?, auxiliar_user_id = ? WHERE id = ?`)
        .run(emAndamentoStatus, Number(plantonistaId), auxiliarNoite?.id ? Number(auxiliarNoite.id) : null, Number(osId));
    })();

    return {
      aguardando: false,
      mecanico: { id: Number(plantonistaId), nome: executor?.name || "Plantonista" },
      auxiliar: auxiliarNoite ? { id: Number(auxiliarNoite.id), nome: auxiliarNoite.name } : null,
      turno: "NOITE",
      plantonista: true,
    };
  }

  const turnoUsers = escalaService.getUsersDoTurno?.("DIA")
    || escalaService.getUsersDoTurnoAtual?.({ prefer: "diurno" })
    || [];

  const auxiliares = getDisponiveis(turnoUsers, "auxiliar", { considerarOcupacao: false });
  const mecanicosDia = getDisponiveis(turnoUsers, "mecanico", { considerarOcupacao: false });
  const escolherMecanicoDia = () => {
    const ordenados = prioritizeMecanicos(mecanicosDia);
    return pickNextMecanicoRoundRobin(ordenados);
  };

  if (grau === "BAIXA") {
    const executor = auxiliares[0] || escolherMecanicoDia();
    if (!executor) {
      db.prepare(`UPDATE os SET status = 'AGUARDANDO_EQUIPE' WHERE id = ?`).run(Number(osId));
      return { aguardando: true, aviso: "Sem executor disponível no turno diurno." };
    }

    db.transaction(() => {
      db.prepare(`UPDATE os_execucoes SET finalizado_em = datetime('now') WHERE os_id = ? AND finalizado_em IS NULL`).run(Number(osId));
      createExecucao(osId, executor.id, null, alocadoPorUserId, null, "DIA");
      db.prepare(`UPDATE os SET status = ?, mecanico_user_id = ?, auxiliar_user_id = NULL WHERE id = ?`)
        .run(emAndamentoStatus, Number(executor.id), Number(osId));
    })();
    return { aguardando: false, mecanico: { id: Number(executor.id), nome: executor.name }, auxiliar: null, turno: "DIA" };
  }

  const mecanico = escolherMecanicoDia();
  if (!mecanico) {
    db.prepare(`UPDATE os SET status = 'AGUARDANDO_EQUIPE' WHERE id = ?`).run(Number(osId));
    return { aguardando: true, aviso: "Sem mecânico disponível no turno diurno." };
  }

  const auxiliar = auxiliares.find((u) => Number(u.id) !== Number(mecanico.id)) || null;

  db.transaction(() => {
    db.prepare(`UPDATE os_execucoes SET finalizado_em = datetime('now') WHERE os_id = ? AND finalizado_em IS NULL`).run(Number(osId));
    createExecucao(osId, mecanico.id, auxiliar?.id || null, alocadoPorUserId, null, "DIA");
    db.prepare(`UPDATE os SET status = ?, mecanico_user_id = ?, auxiliar_user_id = ? WHERE id = ?`)
      .run(emAndamentoStatus, Number(mecanico.id), auxiliar?.id ? Number(auxiliar.id) : null, Number(osId));
  })();

  return {
    aguardando: false,
    mecanico: { id: Number(mecanico.id), nome: mecanico.name },
    auxiliar: auxiliar ? { id: Number(auxiliar.id), nome: auxiliar.name } : null,
    turno: "DIA",
  };
}

function syncOpenOSWithCurrentShift() {
  const turnoAtual = escalaService.getTurnoAtual?.() || "DIA";
  const turnoUsers = escalaService.getUsersDoTurno?.(turnoAtual) || [];
  const turnoUserIds = new Set((turnoUsers || []).map((u) => Number(u.id || u.user_id)).filter(Boolean));

  const emAndamento = db.prepare(`
    SELECT id, status, mecanico_user_id
    FROM os
    WHERE UPPER(COALESCE(status, '')) IN ('ANDAMENTO', 'EM_ANDAMENTO')
  `).all();

  let devolvidasParaFila = 0;
  for (const os of emAndamento) {
    const mecanicoId = Number(os.mecanico_user_id || 0);
    if (!mecanicoId || turnoUserIds.has(mecanicoId)) continue;

    db.transaction(() => {
      if (tableExists("os_execucoes")) {
        db.prepare(`UPDATE os_execucoes SET finalizado_em = datetime('now') WHERE os_id = ? AND finalizado_em IS NULL`)
          .run(Number(os.id));
      }
      db.prepare(`
        UPDATE os
        SET status = 'AGUARDANDO_EQUIPE', mecanico_user_id = NULL, auxiliar_user_id = NULL
        WHERE id = ?
      `).run(Number(os.id));
    })();

    emitOSEvents(Number(os.id), "status");
    devolvidasParaFila += 1;
  }

  const pendentes = db.prepare(`
    SELECT id
    FROM os
    WHERE UPPER(COALESCE(status, '')) IN ('ABERTA', 'AGUARDANDO_EQUIPE')
    ORDER BY id ASC
  `).all();

  let alocadas = 0;
  for (const os of pendentes) {
    const result = autoAssignEquipe(Number(os.id), null);
    if (!result?.aguardando) {
      emitOSEvents(Number(os.id), "status");
      alocadas += 1;
    }
  }

  return { turnoAtual, devolvidasParaFila, alocadas };
}

function setEquipeManual(osId, { mecanico_user_id, auxiliar_user_id }, userId) {
  const os = db.prepare(`SELECT id, status FROM os WHERE id = ?`).get(Number(osId));
  if (!os) throw new Error("OS não encontrada.");
  const status = String(os.status || "").toUpperCase();
  if (["FECHADA", "CANCELADA"].includes(status)) throw new Error("OS fechada/cancelada não permite reatribuição.");
  if (!mecanico_user_id) throw new Error("Executor é obrigatório.");

  const actor = userId ? db.prepare(`SELECT name FROM users WHERE id = ?`).get(Number(userId)) : null;
  const obs = actor?.name ? `Reatribuído por ${actor.name}` : "Reatribuído manualmente";

  const turnoAlocacao = escalaService.getTurnoAtual?.() || null;

  db.transaction(() => {
    db.prepare(`UPDATE os_execucoes SET finalizado_em = datetime('now') WHERE os_id = ? AND finalizado_em IS NULL`).run(Number(osId));
    createExecucao(osId, Number(mecanico_user_id), auxiliar_user_id ? Number(auxiliar_user_id) : null, userId, obs, turnoAlocacao);
    db.prepare(`UPDATE os SET status='EM_ANDAMENTO', mecanico_user_id=?, auxiliar_user_id=? WHERE id = ?`)
      .run(Number(mecanico_user_id), auxiliar_user_id ? Number(auxiliar_user_id) : null, Number(osId));
  })();
}

function setupPairsIfEmpty() {
  if (!tableExists("os_pares_equipes")) return;
  const total = db.prepare(`SELECT COUNT(*) AS total FROM os_pares_equipes`).get()?.total || 0;
  if (Number(total) > 0) return;

  const pares = [["Diogo", "Emanuel"], ["Salviano", "Luís"], ["Rodolfo", "Júnior"], ["Fábio", "Léo"]];
  const findLike = db.prepare(`SELECT id FROM users WHERE name LIKE ? COLLATE NOCASE ORDER BY id LIMIT 1`);
  const insert = db.prepare(`INSERT OR IGNORE INTO os_pares_equipes (mecanico_user_id, auxiliar_user_id, ativo) VALUES (?, ?, 1)`);

  for (const [mec, aux] of pares) {
    const m = findLike.get(`%${mec}%`);
    const a = findLike.get(`%${aux}%`);
    if (m?.id && a?.id) insert.run(Number(m.id), Number(a.id));
  }
}

function autoAssign(osId, alocadoPorUserId = null) {
  const result = autoAssignEquipe(osId, alocadoPorUserId);
  if (!result) return { equipe: [], avisos: [] };
  if (result.aguardando) return { equipe: [], avisos: [result.aviso] };
  return { equipe: listAlocacoesEquipe(Number(osId)), avisos: [] };
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
              COALESCE(u.name, u.email, '-') AS solicitante,
              m.name AS mecanico_nome,
              a.name AS auxiliar_nome
       FROM os o
       LEFT JOIN users u ON u.id = o.opened_by
       LEFT JOIN users m ON m.id = o.mecanico_user_id
       LEFT JOIN users a ON a.id = o.auxiliar_user_id
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

  setupPairsIfEmpty();

  emitOSEvents(osId, "create");
  syncInspecaoFromOS(osId);

  pushService
    .sendPushToAll({
      title: "Nova Ordem de Serviço",
      body: `OS #${osId} - ${equipamentoFinal}`,
      url: `/os/${osId}`,
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
  pushService
    .sendPushToAll({
      title: "OS em andamento",
      body: `OS #${id} entrou em andamento.`,
      url: `/os/${id}`,
    })
    .catch(() => {});
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
  console.log("[OS_CLOSE] fechando OS:", {
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
    if (tableExists("os_execucoes")) {
      db.prepare(`UPDATE os_execucoes SET finalizado_em = datetime('now') WHERE os_id = ? AND finalizado_em IS NULL`).run(id);
    }

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
  pushService
    .sendPushToAll({
      title: "OS finalizada",
      body: `OS #${id} foi finalizada.`,
      url: `/os/${id}`,
    })
    .catch(() => {});
  let syncResult = null;
  if (inspecaoService?.syncFromClosedOS) {
    try {
      console.log("[INSPECAO_SYNC] chamando syncFromClosedOS:", id);
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

  if (st === "ANDAMENTO" || st === "EM_ANDAMENTO") {
    pushService
      .sendPushToAll({
        title: "OS em andamento",
        body: `OS #${id} entrou em andamento.`,
        url: `/os/${id}`,
      })
      .catch(() => {});
  }

  if (["FECHADA", "FINALIZADA", "CONCLUIDA", "CONCLUÍDA"].includes(st)) {
    pushService
      .sendPushToAll({
        title: "OS finalizada",
        body: `OS #${id} foi finalizada.`,
        url: `/os/${id}`,
      })
      .catch(() => {});
  }

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
  listUsuariosEquipe,
  createOS,
  addFotosAberturaFechamento,
  getOSById,
  iniciarOS,
  pausarOS,
  concluirOS,
  updateStatus,
  autoAssign,
  autoAssignEquipe,
  syncOpenOSWithCurrentShift,
  setEquipeManual,
  getExecucaoAtiva,
  setupPairsIfEmpty,
};
