// modules/dashboard/dashboard.service.js
const db = require("../../database/db");

let escalaService = null;
try {
  escalaService = require("../escala/escala.service");
} catch (e) {
  console.warn("⚠️ escala.service não carregou:", e.message);
}

// não derruba o dashboard se faltar tabela
function safeGet(fn, fallback) {
  try {
    return fn();
  } catch (e) {
    const msg = e?.message || "";
    if (msg.includes("no such table")) {
      console.warn("⚠️ [dashboard] tabela ausente:", msg);
      return fallback;
    }
    console.warn("⚠️ [dashboard] erro:", msg);
    return fallback;
  }
}

/* ===============================
   CARDS PRINCIPAIS
=================================*/
function getCards() {
  const os = safeGet(() => {
    return (
      db
        .prepare(
          `
        SELECT COUNT(*) AS total
        FROM os
        WHERE status IN ('ABERTA','ANDAMENTO','PAUSADA')
      `
        )
        .get()?.total || 0
    );
  }, 0);

  const motoresEmpresa = safeGet(() => {
    return (
      db
        .prepare(
          `
        SELECT COUNT(*) AS total
        FROM motores
        WHERE status IN ('EM_USO','RESERVA','RETORNOU')
      `
        )
        .get()?.total || 0
    );
  }, 0);

  const motoresFora = safeGet(() => {
    return (
      db
        .prepare(
          `
        SELECT COUNT(*) AS total
        FROM motores
        WHERE status = 'ENVIADO_REBOB'
      `
        )
        .get()?.total || 0
    );
  }, 0);

  const equipamentosAtivos = safeGet(() => {
    return (
      db
        .prepare(
          `
        SELECT COUNT(*) AS total
        FROM equipamentos
        WHERE ativo = 1
      `
        )
        .get()?.total || 0
    );
  }, 0);

  return {
    os_abertas: os,
    motores_empresa: motoresEmpresa,
    motores_conserto: motoresFora,
    equipamentos: equipamentosAtivos,
  };
}

/* ===============================
   PREVENTIVAS ATIVAS (DASHBOARD)
   tabelas corretas: preventiva_planos / preventiva_execucoes
=================================*/
function getPreventivasDashboard() {
  return safeGet(() => {
    return db
      .prepare(
        `
      SELECT
        pe.id,
        COALESCE(e.nome, pp.titulo, '-') AS equipamento_nome,
        pe.data_prevista,
        pe.status,
        pe.responsavel,
        pe.observacao
      FROM preventiva_execucoes pe
      JOIN preventiva_planos pp ON pp.id = pe.plano_id
      LEFT JOIN equipamentos e ON e.id = pp.equipamento_id
      WHERE pe.status IN ('pendente','atrasada','andamento','em_andamento')
      ORDER BY
        CASE WHEN pe.data_prevista IS NULL THEN 1 ELSE 0 END,
        pe.data_prevista ASC
      LIMIT 50
    `
      )
      .all();
  }, []);
}

/* ===============================
   ESCALA
   retorna no formato que a view espera:
   { turno_dia: "NOMES", turno_noite: "NOMES" }
=================================*/
function getEscalaSemana() {
  // tenta o método existente (seja qual for o nome)
  const raw = safeGet(() => {
    if (!escalaService) return null;

    if (typeof escalaService.getPlantaoAgora === "function") {
      return escalaService.getPlantaoAgora();
    }
    if (typeof escalaService.getSemanaAtualDashboard === "function") {
      return escalaService.getSemanaAtualDashboard();
    }
    return null;
  }, null);

  if (!raw) return null;

  // normaliza vários formatos possíveis
  // 1) já veio como strings
  if (raw.turno_dia || raw.turno_noite) {
    return {
      turno_dia: raw.turno_dia || "-",
      turno_noite: raw.turno_noite || "-",
    };
  }

  // 2) veio com arrays (dia/noite)
  if (Array.isArray(raw.dia) || Array.isArray(raw.noite)) {
    return {
      turno_dia: Array.isArray(raw.dia) && raw.dia.length ? raw.dia.join(", ") : "-",
      turno_noite: Array.isArray(raw.noite) && raw.noite.length ? raw.noite.join(", ") : "-",
    };
  }

  // 3) veio com campos diferentes (plantao, etc.)
  return {
    turno_dia: raw.dia || raw.turnoDia || raw.diurno || "-",
    turno_noite: raw.noite || raw.turnoNoite || raw.noturno || "-",
  };
}

module.exports = {
  getCards,
  getPreventivasDashboard,
  getEscalaSemana,
};
