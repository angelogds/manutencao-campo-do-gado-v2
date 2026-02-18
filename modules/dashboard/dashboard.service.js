// modules/dashboard/dashboard.service.js
const db = require("../../database/db");

// ⚠️ tenta usar o serviço da escala (não pode derrubar o dashboard se não existir)
let escalaService = null;
try {
  escalaService = require("../escala/escala.service");
} catch (e) {
  console.warn("⚠️ [dashboard] escala.service não carregou:", e.message);
}

function safeCount(sql, params = []) {
  try {
    return db.prepare(sql).get(...params)?.total || 0;
  } catch (e) {
    return 0;
  }
}

function getOsCards() {
  const abertas = safeCount(`SELECT COUNT(*) AS total FROM os WHERE status IN ('ABERTA')`);
  const andamento = safeCount(`SELECT COUNT(*) AS total FROM os WHERE status IN ('ANDAMENTO','PAUSADA')`);
  const concluidas = safeCount(`SELECT COUNT(*) AS total FROM os WHERE status IN ('CONCLUIDA')`);
  return { abertas, andamento, concluidas };
}

function getEquipamentosCards() {
  const ativos = safeCount(`SELECT COUNT(*) AS total FROM equipamentos WHERE ativo = 1`);

  const em_manutencao = safeCount(`
    SELECT COUNT(*) AS total FROM (
      SELECT DISTINCT equipamento_id
      FROM os
      WHERE equipamento_id IS NOT NULL
        AND status IN ('ANDAMENTO','PAUSADA')
    ) t
  `);

  const parados = safeCount(`
    SELECT COUNT(*) AS total FROM (
      SELECT DISTINCT equipamento_id
      FROM os
      WHERE equipamento_id IS NOT NULL
        AND status IN ('PAUSADA')
    ) t
  `);

  return { ativos, em_manutencao, parados };
}

function getMotoresEmConserto(limit = 8) {
  try {
    const rows = db
      .prepare(
        `
        SELECT
          id,
          codigo,
          descricao,
          empresa_rebob,
          data_saida,
          CAST((julianday('now') - julianday(COALESCE(data_saida, date('now')))) AS INTEGER) AS dias
        FROM motores
        WHERE status = 'ENVIADO_REBOB'
        ORDER BY COALESCE(data_saida, created_at) ASC
        LIMIT ?
      `
      )
      .all(limit);
    return rows || [];
  } catch (e) {
    return [];
  }
}

function getMotoresCards() {
  const em_conserto = safeCount(`SELECT COUNT(*) AS total FROM motores WHERE status = 'ENVIADO_REBOB'`);
  return { em_conserto };
}

function getPreventivasProgramadas(limit = 10) {
  try {
    const rows = db
      .prepare(
        `
        SELECT
          e.id AS exec_id,
          COALESCE(eq.nome, 'Equipamento') AS equipamento_nome,
          e.responsavel,
          e.data_prevista,
          e.status,
          e.observacao
        FROM preventiva_execucoes e
        JOIN preventiva_planos p ON p.id = e.plano_id
        LEFT JOIN equipamentos eq ON eq.id = p.equipamento_id
        WHERE (e.status IN ('pendente','atrasada','andamento','em_andamento','programada') OR e.status IS NULL)
          AND (e.data_executada IS NULL OR e.data_executada = '')
        ORDER BY
          CASE WHEN e.data_prevista IS NULL OR e.data_prevista = '' THEN 1 ELSE 0 END,
          e.data_prevista ASC,
          e.id ASC
        LIMIT ?
      `
      )
      .all(limit);

    return (rows || []).map((r) => {
      const first = (r.responsavel || "").trim().split(/\s+/)[0] || "-";
      return { ...r, responsavel_first: first };
    });
  } catch (e) {
    return [];
  }
}

function mapPrevStatus(status) {
  const s = (status || "").toLowerCase();
  if (s === "andamento" || s === "em_andamento") return "EM_ANDAMENTO";
  if (s === "atrasada") return "ATRASADA";
  if (s === "executada") return "CONCLUIDA";
  return "PROGRAMADA";
}

function getEscalaSemana() {
  if (!escalaService || typeof escalaService.getSemanaPorData !== "function") {
    return null;
  }

  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");
  const iso = `${yyyy}-${mm}-${dd}`;

  const semana = escalaService.getSemanaPorData(iso);
  if (!semana || !semana.rows) return null;

  const dia = [];
  const noite = [];
  const apoio = [];

  for (const r of semana.rows) {
    const turno = (r.turno || "").toLowerCase();
    const nome = r.colaborador;
    if (!nome) continue;
    if (turno.includes("noite")) noite.push(nome);
    else if (turno.includes("apoio")) apoio.push(nome);
    else dia.push(nome);
  }

  return { periodo: semana.periodo, dia, noite, apoio };
}

function getDashboardData() {
  const os = getOsCards();
  const equipamentos = getEquipamentosCards();
  const motores = getMotoresCards();
  const motoresLista = getMotoresEmConserto(8);
  const preventivasLista = getPreventivasProgramadas(12).map((p) => ({
    ...p,
    status_ui: mapPrevStatus(p.status),
  }));
  const escala = getEscalaSemana();

  return { os, equipamentos, motores, motoresLista, preventivasLista, escala };
}

module.exports = { getDashboardData };
