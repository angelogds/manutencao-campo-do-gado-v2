const db = require("../../database/db");
const escalaService = require("../escala/escala.service");

function getCards() {
  // OS abertas
  const os = db.prepare(`
    SELECT COUNT(*) AS total
    FROM os
    WHERE status IN ('ABERTA','ANDAMENTO','PAUSADA')
  `).get()?.total || 0;

  // Compras abertas (status do seu 050 é minúsculo)
  const compras = db.prepare(`
    SELECT COUNT(*) AS total
    FROM solicitacoes_compra
    WHERE status IN ('aberta','cotacao','aprovada')
  `).get()?.total || 0;

  // itens estoque
  const itens = db.prepare(`
    SELECT COUNT(*) AS total
    FROM estoque_itens
    WHERE ativo = 1
  `).get()?.total || 0;

  // equipamentos
  const equip = db.prepare(`
    SELECT COUNT(*) AS total
    FROM equipamentos
    WHERE ativo = 1
  `).get()?.total || 0;

  return { os_abertas: os, compras_abertas: compras, itens_estoque: itens, equipamentos: equip };
}

function getPlantaoAgora() {
  return escalaService.getPlantaoAgora();
}

module.exports = { getCards, getPlantaoAgora };
