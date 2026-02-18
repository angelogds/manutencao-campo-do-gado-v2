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

  const equipamentosResumo = safeGet(() => {
    const row = db
      .prepare(
        `
        SELECT
          SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END) AS ativos,
          SUM(CASE WHEN ativo = 0 THEN 1 ELSE 0 END) AS inativos
        FROM equipamentos
      `
      )
      .get();

    return {
      ativos: Number(row?.ativos || 0),
      inativos: Number(row?.inativos || 0),
    };
  }, { ativos: 0, inativos: 0 });

  return {
    os_abertas: os,
    motores_empresa: motoresEmpresa,
    motores_conserto: motoresFora,
    equipamentos_ativos: equipamentosResumo.ativos,
    equipamentos_inativos: equipamentosResumo.inativos,
  };
}

function getMotoresResumoDashboard() {
  return safeGet(() => {
    const resumo = db
      .prepare(
        `
        SELECT
          SUM(CASE WHEN status = 'EM_USO' THEN 1 ELSE 0 END) AS em_funcionamento,
          SUM(CASE WHEN status IN ('RESERVA', 'RETORNOU') THEN 1 ELSE 0 END) AS em_estoque,
          SUM(CASE WHEN status = 'ENVIADO_REBOB' THEN 1 ELSE 0 END) AS em_conserto
        FROM motores
      `
      )
      .get();

    const emConserto = db
      .prepare(
        `
        SELECT
          id,
          COALESCE(codigo, '-') AS codigo,
          descricao,
          data_saida,
          CAST(julianday('now') - julianday(data_saida) AS INTEGER) AS dias_conserto
        FROM motores
        WHERE status = 'ENVIADO_REBOB'
        ORDER BY datetime(data_saida) ASC
      `
      )
      .all();

    return {
      em_funcionamento: Number(resumo?.em_funcionamento || 0),
      em_estoque: Number(resumo?.em_estoque || 0),
      em_conserto: Number(resumo?.em_conserto || 0),
      itens_em_conserto: emConserto,
    };
  }, {
    em_funcionamento: 0,
    em_estoque: 0,
    em_conserto: 0,
    itens_em_conserto: [],
  });
}

function getEscalaPainelSemana() {
  return safeGet(() => {
    const semana = db
      .prepare(
        `
        SELECT id, semana_numero, data_inicio, data_fim
        FROM escala_semanas
        WHERE date('now', 'localtime') BETWEEN data_inicio AND data_fim
        LIMIT 1
      `
      )
      .get();

    if (!semana) return null;

    const alocacoes = db
      .prepare(
        `
        SELECT
          c.nome,
          COALESCE(NULLIF(c.funcao, ''), '-') AS funcao,
          a.tipo_turno
        FROM escala_alocacoes a
        JOIN colaboradores c ON c.id = a.colaborador_id
        WHERE a.semana_id = ?
        ORDER BY
          CASE a.tipo_turno
            WHEN 'diurno' THEN 1
            WHEN 'apoio' THEN 2
            WHEN 'noturno' THEN 3
            ELSE 4
          END,
          c.nome ASC
      `
      )
      .all(semana.id);

    return {
      ...semana,
      diurno_mecanicos: alocacoes.filter((a) => a.tipo_turno === "diurno"),
      apoio_operacional: alocacoes.filter((a) => a.tipo_turno === "apoio"),
      noturno: alocacoes.filter((a) => a.tipo_turno === "noturno"),
    };
  }, null);
}

function getOSResumoStatus() {
  return safeGet(() => {
    const rows = db
      .prepare(
        `
        SELECT status, COUNT(*) AS total
        FROM os
        GROUP BY status
      `
      )
      .all();

    const resumo = {
      abertas: 0,
      andamento: 0,
      fechadas: 0,
    };

    rows.forEach((row) => {
      const status = String(row.status || "").toUpperCase();
      const total = Number(row.total || 0);

      if (status === "ABERTA") resumo.abertas += total;
      else if (status === "ANDAMENTO" || status === "PAUSADA") resumo.andamento += total;
      else if (status === "CONCLUIDA" || status === "CANCELADA" || status === "FINALIZADA") {
        resumo.fechadas += total;
      }
    });

    return resumo;
  }, { abertas: 0, andamento: 0, fechadas: 0 });
}

function getOSPainel(page = 1, pageSize = 10) {
  return safeGet(() => {
    const pagina = Math.max(Number(page) || 1, 1);
    const tamanho = Math.min(Math.max(Number(pageSize) || 10, 1), 50);
    const offset = (pagina - 1) * tamanho;

    const total =
      db
        .prepare(
          `
          SELECT COUNT(*) AS total
          FROM os
        `
        )
        .get()?.total || 0;

    const itens = db
      .prepare(
        `
          SELECT id, equipamento, descricao, tipo, status, opened_at
          FROM os
          ORDER BY
            CASE status
              WHEN 'ABERTA' THEN 1
              WHEN 'ANDAMENTO' THEN 2
              WHEN 'PAUSADA' THEN 3
              WHEN 'CONCLUIDA' THEN 4
              WHEN 'CANCELADA' THEN 5
              ELSE 6
            END,
            datetime(opened_at) DESC,
            id DESC
          LIMIT ? OFFSET ?
        `
      )
      .all(tamanho, offset);

    const totalPages = Math.max(Math.ceil(total / tamanho), 1);

    return {
      items: itens,
      total,
      page: pagina,
      pageSize: tamanho,
      totalPages,
      hasPrev: pagina > 1,
      hasNext: pagina < totalPages,
    };
  }, {
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
}

function getHistoricoEquipamentos(limit = 8) {
  return safeGet(() => {
    return db
      .prepare(
        `
        SELECT
          COALESCE(equipamento, '-') AS equipamento,
          COUNT(*) AS total_os,
          SUM(CASE WHEN status IN ('ABERTA','ANDAMENTO','PAUSADA') THEN 1 ELSE 0 END) AS os_abertas,
          SUM(CASE WHEN UPPER(tipo) = 'CORRETIVA' THEN 1 ELSE 0 END) AS corretivas,
          SUM(CASE WHEN UPPER(tipo) = 'PREVENTIVA' THEN 1 ELSE 0 END) AS preventivas
        FROM os
        GROUP BY COALESCE(equipamento, '-')
        ORDER BY os_abertas DESC, total_os DESC, equipamento ASC
        LIMIT ?
      `
      )
      .all(Number(limit) || 8);
  }, []);
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
  getMotoresResumoDashboard,
  getOSResumoStatus,
  getOSPainel,
  getHistoricoEquipamentos,
  getPreventivasDashboard,
  getEscalaSemana,
  getEscalaPainelSemana,
};
