// modules/dashboard/dashboard.service.js
const db = require("../../database/db");

let escalaService = null;
try {
  escalaService = require("../escala/escala.service");
} catch (e) {
  console.warn("⚠️ [dashboard] escala.service não carregou:", e.message);
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

  // 🔧 PREVENTIVAS (tabela correta)
  let preventivas = 0;
  try {
    preventivas = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM preventivas
        WHERE ativo = 1
      `)
      .get()?.total || 0;
  } catch (err) {
    console.warn("⚠️ Tabela preventivas não encontrada.");
  }

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
    preventivas,
    motores_empresa: motoresEmpresa,
    motores_conserto: motoresFora,
  };
}

/* ===============================
   PREVENTIVAS ORDENADAS
=================================*/
function getPreventivasOrdenadas() {
  try {
    return db
      .prepare(`
        SELECT id, equipamento_id, periodicidade_dias
        FROM preventivas
        WHERE ativo = 1
        ORDER BY equipamento_id ASC
        LIMIT 6
      `)
      .all();
  } catch (err) {
    return [];
  }
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
  getPreventivasOrdenadas,
  getEscalaSemana,
};
