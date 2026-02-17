// modules/dashboard/dashboard.service.js
const db = require("../../database/db");

// ⚠️ pega o serviço correto da escala
let escalaService = null;
try {
  escalaService = require("../escala/escala.service");
} catch (e) {
  console.warn("⚠️ [dashboard] escala.service não carregou:", e.message);
}

function getCards() {
  // =============================
  // ORDEM DE SERVIÇO
  // =============================
  const os = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM os
      WHERE status IN ('ABERTA','ANDAMENTO','PAUSADA')
    `
    )
    .get()?.total || 0;

  // =============================
  // COMPRAS
  // =============================
  const compras = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM solicitacoes_compra
      WHERE status IN ('aberta','cotacao','aprovada')
    `
    )
    .get()?.total || 0;

  // =============================
  // ESTOQUE
  // =============================
  const itens = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM estoque_itens
      WHERE ativo = 1
    `
    )
    .get()?.total || 0;

  // =============================
  // EQUIPAMENTOS
  // =============================
  const equip = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM equipamentos
      WHERE ativo = 1
    `
    )
    .get()?.total || 0;

  // =============================
  // 🔧 MOTORES EM CONSERTO
  // =============================
  const motoresConserto = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM motores
      WHERE status = 'ENVIADO_REBOB'
    `
    )
    .get()?.total || 0;

  // =============================
  // 🔧 TEMPO MÉDIO EM CONSERTO
  // =============================
  const tempoMedio = db
    .prepare(
      `
      SELECT 
        ROUND(AVG(julianday('now') - julianday(data_saida))) AS dias
      FROM motores
      WHERE status = 'ENVIADO_REBOB'
      AND data_saida IS NOT NULL
    `
    )
    .get()?.dias || 0;

  // =============================
  // 🔧 Motor mais antigo fora
  // =============================
  const motorMaisAntigo = db
    .prepare(
      `
      SELECT 
        id,
        descricao,
        empresa_rebob,
        CAST((julianday('now') - julianday(data_saida)) AS INTEGER) AS dias
      FROM motores
      WHERE status = 'ENVIADO_REBOB'
      AND data_saida IS NOT NULL
      ORDER BY data_saida ASC
      LIMIT 1
    `
    )
    .get() || null;

  return {
    os_abertas: os,
    compras_abertas: compras,
    itens_estoque: itens,
    equipamentos: equip,

    // 🔧 Novo bloco motores
    motores_conserto: motoresConserto,
    motores_tempo_medio: tempoMedio,
    motor_mais_antigo: motorMaisAntigo,
  };
}

function getPlantaoAgora() {
  if (!escalaService || typeof escalaService.getPlantaoAgora !== "function") {
    return null;
  }
  return escalaService.getPlantaoAgora();
}

module.exports = { getCards, getPlantaoAgora };
