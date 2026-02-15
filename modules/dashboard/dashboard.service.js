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
  const os = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM os
      WHERE status IN ('ABERTA','ANDAMENTO','PAUSADA')
    `
    )
    .get()?.total || 0;

  const compras = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM solicitacoes_compra
      WHERE status IN ('aberta','cotacao','aprovada')
    `
    )
    .get()?.total || 0;

  const itens = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM estoque_itens
      WHERE ativo = 1
    `
    )
    .get()?.total || 0;

  const equip = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM equipamentos
      WHERE ativo = 1
    `
    )
    .get()?.total || 0;

  return {
    os_abertas: os,
    compras_abertas: compras,
    itens_estoque: itens,
    equipamentos: equip,
  };
}

function getPlantaoAgora() {
  // Se ainda não existir na escala.service, não derruba o dashboard
  if (!escalaService || typeof escalaService.getPlantaoAgora !== "function") {
    return null;
  }
  return escalaService.getPlantaoAgora();
}

module.exports = { getCards, getPlantaoAgora };
