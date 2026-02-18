// modules/dashboard/dashboard.service.js
const db = require("../../database/db");

// tenta carregar escala.service (não derruba se não existir)
let escalaService = null;
try {
  escalaService = require("../escala/escala.service");
} catch (e) {
  console.warn("⚠️ [dashboard] escala.service não carregou:", e.message);
}

// helper: executa query sem derrubar dashboard se tabela não existir
function safeGet(fn, fallback) {
  try {
    return fn();
  } catch (e) {
    // evita derrubar o painel se estiver faltando tabela em alguma base antiga
    const msg = (e && e.message) ? e.message : "";
    if (msg.includes("no such table")) {
      console.warn("⚠️ [dashboard] tabela ausente:", msg);
      return fallback;
    }
    throw e;
  }
}

function getOSResumo() {
  const abertas = safeGet(() => {
    return db.prepare(`
      SELECT COUNT(*) AS total
      FROM os
      WHERE status = 'ABERTA'
    `).get()?.total || 0;
  }, 0);

  const andamento = safeGet(() => {
    return db.prepare(`
      SELECT COUNT(*) AS total
      FROM os
      WHERE status IN ('ANDAMENTO','PAUSADA')
    `).get()?.total || 0;
  }, 0);

  const concluidas = safeGet(() => {
    return db.prepare(`
      SELECT COUNT(*) AS total
      FROM os
      WHERE status = 'CONCLUIDA'
    `).get()?.total || 0;
  }, 0);

  const lista = safeGet(() => {
    return db.prepare(`
      SELECT
        os.id,
        os.tipo,
        os.status,
        os.descricao,
        os.created_at,
        COALESCE(e.nome, os.equipamento, '-') AS equipamento_nome
      FROM os
      LEFT JOIN equipamentos e ON e.id = os.equipamento_id
      WHERE os.status IN ('ABERTA','ANDAMENTO','PAUSADA')
      ORDER BY datetime(os.created_at) DESC
      LIMIT 12
    `).all();
  }, []);

  return { abertas, andamento, concluidas, lista };
}

function getPreventivasProgramadas() {
  // usa as tabelas corretas: preventiva_planos / preventiva_execucoes
  const lista = safeGet(() => {
    return db.prepare(`
      SELECT
        pe.id,
        pe.status,
        pe.data_prevista,
        pe.responsavel,
        pe.observacao,
        COALESCE(e.nome, pp.titulo, '-') AS equipamento_nome
      FROM preventiva_execucoes pe
      JOIN preventiva_planos pp ON pp.id = pe.plano_id
      LEFT JOIN equipamentos e ON e.id = pp.equipamento_id
      WHERE pe.status IN ('pendente','andamento','atrasada')
      ORDER BY
        CASE
          WHEN pe.data_prevista IS NULL THEN 1
          ELSE 0
        END,
        pe.data_prevista ASC
      LIMIT 20
    `).all();
  }, []);

  return { lista };
}

function getMotoresEmConserto() {
  const lista = safeGet(() => {
    return db.prepare(`
      SELECT
        id,
        codigo,
        descricao,
        empresa_rebob,
        data_saida,
        created_at,
        CAST(
          (julianday('now') - julianday(COALESCE(data_saida, created_at)))
          AS INT
        ) AS dias_em_conserto
      FROM motores
      WHERE status = 'ENVIADO_REBOB'
      ORDER BY
        CASE WHEN data_saida IS NULL THEN 1 ELSE 0 END,
        datetime(COALESCE(data_saida, created_at)) DESC
      LIMIT 12
    `).all();
  }, []);

  const total = Array.isArray(lista) ? lista.length : 0;
  return { total, lista };
}

function getEquipamentosResumo() {
  const ativos = safeGet(() => {
    return db.prepare(`
      SELECT COUNT(*) AS total
      FROM equipamentos
      WHERE ativo = 1
    `).get()?.total || 0;
  }, 0);

  const parados = safeGet(() => {
    // aqui "parados" = inativos (ativo=0), porque ainda não existe status_operacional
    return db.prepare(`
      SELECT COUNT(*) AS total
      FROM equipamentos
      WHERE ativo = 0
    `).get()?.total || 0;
  }, 0);

  const manutencao = safeGet(() => {
    return db.prepare(`
      SELECT COUNT(DISTINCT e.id) AS total
      FROM equipamentos e
      JOIN os ON os.equipamento_id = e.id
      WHERE e.ativo = 1
        AND os.status IN ('ABERTA','ANDAMENTO','PAUSADA')
    `).get()?.total || 0;
  }, 0);

  return { ativos, manutencao, parados };
}

function getEscalaSemana() {
  // se existir método pronto na escala.service, usa
  if (escalaService && typeof escalaService.getSemanaAtualDashboard === "function") {
    return escalaService.getSemanaAtualDashboard();
  }

  // fallback direto no banco (baseado nas migrations 060+)
  const semana = safeGet(() => {
    return db.prepare(`
      SELECT id, data_inicio, data_fim
      FROM escala_semanas
      WHERE date('now') BETWEEN date(data_inicio) AND date(data_fim)
      ORDER BY date(data_inicio) DESC
      LIMIT 1
    `).get();
  }, null);

  if (!semana) return null;

  const alocacoes = safeGet(() => {
    return db.prepare(`
      SELECT
        a.tipo_turno,
        c.nome
      FROM escala_alocacoes a
      JOIN colaboradores c ON c.id = a.colaborador_id
      WHERE a.semana_id = ?
      ORDER BY
        CASE a.tipo_turno
          WHEN 'diurno' THEN 1
          WHEN 'noturno' THEN 2
          WHEN 'apoio' THEN 3
          WHEN 'plantao' THEN 4
          WHEN 'folga' THEN 5
          ELSE 9
        END,
        c.nome ASC
    `).all(semana.id);
  }, []);

  const dia = alocacoes.filter(x => x.tipo_turno === "diurno").map(x => x.nome);
  const noite = alocacoes.filter(x => x.tipo_turno === "noturno").map(x => x.nome);
  const apoio = alocacoes.filter(x => x.tipo_turno === "apoio").map(x => x.nome);

  return {
    data_inicio: semana.data_inicio,
    data_fim: semana.data_fim,
    dia,
    noite,
    apoio,
  };
}

function getDashboardData() {
  const os = getOSResumo();
  const preventivas = getPreventivasProgramadas();
  const motores = getMotoresEmConserto();
  const equipamentos = getEquipamentosResumo();
  const escala = getEscalaSemana();

  return { os, preventivas, motores, equipamentos, escala };
}

module.exports = {
  getDashboardData,
};
