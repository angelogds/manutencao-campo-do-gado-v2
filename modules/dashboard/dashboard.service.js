const db = require("../../database/db");

// helpers
function hasTable(table) {
  try {
    const r = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table);
    return !!r;
  } catch {
    return false;
  }
}

function safeGet(sql, params = []) {
  try {
    return db.prepare(sql).get(...params);
  } catch {
    return null;
  }
}

function safeAll(sql, params = []) {
  try {
    return db.prepare(sql).all(...params);
  } catch {
    return [];
  }
}

// ======================
// KPIs OS
// ======================
function countOS(status) {
  if (!hasTable("os")) return 0;
  const row = safeGet("SELECT COUNT(*) AS n FROM os WHERE status = ?", [status]);
  return Number(row?.n || 0);
}

function countOSFechadas() {
  return countOS("CONCLUIDA") + countOS("CANCELADA");
}

// ======================
// KPIs Compras / Solicitação
// status: aberta|cotacao|aprovada|comprada|recebida|cancelada
// ======================
function countSolic(status) {
  if (!hasTable("solicitacoes_compra")) return 0;
  const row = safeGet(
    "SELECT COUNT(*) AS n FROM solicitacoes_compra WHERE status = ?",
    [status]
  );
  return Number(row?.n || 0);
}

// ======================
// Escala do dia (hoje)
// tabela: escala_alocacoes -> escala_semanas -> escala_periodos
// pega semana vigente e lista alocações por tipo_turno
// ======================
function getEscalaResumoHoje() {
  if (
    !hasTable("escala_periodos") ||
    !hasTable("escala_semanas") ||
    !hasTable("escala_alocacoes") ||
    !hasTable("colaboradores")
  ) {
    return { dia: "—", noite: "—", apoio: "—", periodo: "—", semana: "—" };
  }

  // acha semana vigente hoje
  const semana = safeGet(`
    SELECT s.id, s.semana_numero, s.data_inicio, s.data_fim, p.titulo
    FROM escala_semanas s
    JOIN escala_periodos p ON p.id = s.periodo_id
    WHERE date('now') BETWEEN s.data_inicio AND s.data_fim
    ORDER BY s.id DESC
    LIMIT 1
  `);

  if (!semana) {
    return { dia: "—", noite: "—", apoio: "—", periodo: "—", semana: "—" };
  }

  const rows = safeAll(
    `
    SELECT a.tipo_turno, c.nome
    FROM escala_alocacoes a
    JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.semana_id = ?
    ORDER BY a.tipo_turno, c.nome
  `,
    [semana.id]
  );

  const dia = [];
  const noite = [];
  const apoio = [];

  for (const r of rows) {
    const t = String(r.tipo_turno || "").toLowerCase();
    if (t === "diurno") dia.push(r.nome);
    if (t === "noturno" || t === "plantao") noite.push(r.nome);
    if (t === "apoio") apoio.push(r.nome);
  }

  return {
    dia: dia.length ? dia.join(", ") : "—",
    noite: noite.length ? noite.join(", ") : "—",
    apoio: apoio.length ? apoio.join(", ") : "—",
    periodo: semana.titulo || "—",
    semana: semana.semana_numero != null ? `Semana ${semana.semana_numero}` : "—",
  };
}

// ======================
// Estoque: últimas movimentações
// tables: estoque_itens + estoque_movimentos
// ======================
function getEstoqueUpdates(limit = 6) {
  if (!hasTable("estoque_itens")) return [];

  // prioridade: movimentos
  if (hasTable("estoque_movimentos")) {
    return safeAll(
      `
      SELECT
        i.id AS item_id,
        i.nome,
        i.unidade,
        m.tipo,
        m.quantidade AS mov_qtd,
        COALESCE(m.custo_unit, i.custo_unit, 0) AS custo_unit,
        m.origem,
        m.referencia_id,
        m.observacao,
        m.created_at AS data_evento
      FROM estoque_movimentos m
      JOIN estoque_itens i ON i.id = m.item_id
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?
    `,
      [limit]
    );
  }

  // fallback: itens recém criados
  return safeAll(
    `
    SELECT
      id AS item_id,
      nome,
      unidade,
      NULL AS tipo,
      NULL AS mov_qtd,
      custo_unit,
      NULL AS origem,
      NULL AS referencia_id,
      NULL AS observacao,
      created_at AS data_evento
    FROM estoque_itens
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `,
    [limit]
  );
}

// ======================
// Atividade recente: OS fechadas (mecânico)
// (se closed_by existir e users existir com nome/name)
// ======================
function hasColumn(table, col) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    return cols.some((c) => c.name === col);
  } catch {
    return false;
  }
}

function pickUserNameExpr() {
  if (!hasTable("users")) return "NULL";
  if (hasColumn("users", "nome")) return "u.nome";
  if (hasColumn("users", "name")) return "u.name";
  return "NULL";
}

function getRecentClosedOS(limit = 8) {
  if (!hasTable("os")) return [];

  const hasClosedAt = hasColumn("os", "closed_at");
  const hasClosedBy = hasColumn("os", "closed_by");
  const hasEquipText = hasColumn("os", "equipamento");
  const hasEquipId = hasColumn("os", "equipamento_id") && hasTable("equipamentos");

  const dateExpr = hasClosedAt ? "o.closed_at" : "o.opened_at";
  const joinUser = hasClosedBy
    ? "LEFT JOIN users u ON u.id = o.closed_by"
    : "LEFT JOIN users u ON 1=0";

  const userExpr = hasClosedBy ? pickUserNameExpr() : "NULL";
  const joinEq = hasEquipId ? "LEFT JOIN equipamentos e ON e.id = o.equipamento_id" : "LEFT JOIN equipamentos e ON 1=0";

  const eqExpr = hasEquipId
    ? "COALESCE(e.nome, o.equipamento)"
    : (hasEquipText ? "o.equipamento" : "NULL");

  const sql = `
    SELECT
      o.id,
      ${eqExpr} AS equipamento,
      o.descricao,
      o.status,
      ${dateExpr} AS data_evento,
      ${userExpr} AS mecanico
    FROM os o
    ${joinEq}
    ${joinUser}
    WHERE o.status IN ('CONCLUIDA','CANCELADA')
    ORDER BY ${dateExpr} DESC, o.id DESC
    LIMIT ?
  `;

  return safeAll(sql, [limit]);
}

// ======================
// Dashboard data
// ======================
exports.getDashboardData = () => {
  const data = {
    kpis: {
      osAbertas: countOS("ABERTA"),
      osAndamento: countOS("ANDAMENTO"),
      osFechadas: countOSFechadas(),

      // compras/solicitações
      solAbertas: countSolic("aberta"),
      solAprovadas: countSolic("aprovada"),
    },

    escala: getEscalaResumoHoje(),

    estoqueUpdates: getEstoqueUpdates(6),

    osRecentesFechadas: getRecentClosedOS(8),

    now: new Date().toISOString(),
  };

  return data;
};
