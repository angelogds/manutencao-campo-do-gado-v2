// modules/dashboard/dashboard.service.js
const db = require("../../database/db");

let escalaService = null;
try {
  escalaService = require("../escala/escala.service");
} catch (e) {
  console.warn("⚠️ escala.service não carregou:", e.message);
}

/* ===============================
   CARDS PRINCIPAIS
=================================*/
function getCards() {
  const os = db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM os
      WHERE status IN ('ABERTA','ANDAMENTO','PAUSADA')
    `)
    .get()?.total || 0;

  const motoresEmpresa = db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM motores
      WHERE status IN ('EM_USO','RESERVA','RETORNOU')
    `)
    .get()?.total || 0;

  const motoresFora = db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM motores
      WHERE status = 'ENVIADO_REBOB'
    `)
    .get()?.total || 0;

  return {
    os_abertas: os,
    motores_empresa: motoresEmpresa,
    motores_conserto: motoresFora,
  };
}

/* ===============================
   PREVENTIVAS ATIVAS (DASHBOARD)
=================================*/
function getPreventivasDashboard() {
  return db.prepare(`
    SELECT
      pe.id,
      e.nome AS equipamento_nome,
      pe.data_prevista,
      pe.status,
      pe.responsavel,
      pe.observacao
    FROM preventiva_execucoes pe
    JOIN preventiva_planos pp ON pp.id = pe.plano_id
    LEFT JOIN equipamentos e ON e.id = pp.equipamento_id
    WHERE pe.status IN ('pendente','atrasada','em_andamento')
    ORDER BY pe.data_prevista ASC
  `).all();
}

/* ===============================
   ESCALA
=================================*/
function getEscalaSemana() {
  if (!escalaService || typeof escalaService.getPlantaoAgora !== "function") {
    return null;
  }
  return escalaService.getPlantaoAgora();
}

module.exports = {
  getCards,
  getPreventivasDashboard,
  getEscalaSemana,
};
