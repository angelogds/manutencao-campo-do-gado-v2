// modules/dashboard/dashboard.service.js
const db = require("../../database/db");

function getCounters() {
  // OS (status em MAIÚSCULO conforme 030_os.sql)
  const osAbertas = db
    .prepare(`SELECT COUNT(*) AS n FROM os WHERE status = 'ABERTA'`)
    .get().n;

  const osAndamento = db
    .prepare(`SELECT COUNT(*) AS n FROM os WHERE status = 'ANDAMENTO'`)
    .get().n;

  const osPausada = db
    .prepare(`SELECT COUNT(*) AS n FROM os WHERE status = 'PAUSADA'`)
    .get().n;

  const osConcluida = db
    .prepare(`SELECT COUNT(*) AS n FROM os WHERE status = 'CONCLUIDA'`)
    .get().n;

  // Compras pendentes (são SOLICITAÇÕES que têm aberta/cotacao/aprovada)
  const comprasPendentes = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM solicitacoes_compra
       WHERE status IN ('aberta','cotacao','aprovada')`
    )
    .get().n;

  // Itens em estoque
  const itensEstoque = db
    .prepare(`SELECT COUNT(*) AS n FROM estoque_itens`)
    .get().n;

  return {
    osAbertas,
    osAndamento,
    osPausada,
    osConcluida,
    comprasPendentes,
    itensEstoque,
  };
}

module.exports = { getCounters };
