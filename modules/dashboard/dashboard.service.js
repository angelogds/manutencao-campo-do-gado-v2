// modules/dashboard/dashboard.service.js
const db = require("../../database/db");

exports.getCounters = () => {
  const osAbertas = db.prepare(
    `SELECT COUNT(*) as n FROM os WHERE status = 'ABERTA'`
  ).get().n;

  const osAndamento = db.prepare(
    `SELECT COUNT(*) as n FROM os WHERE status = 'ANDAMENTO'`
  ).get().n;

  const osConcluida = db.prepare(
    `SELECT COUNT(*) as n FROM os WHERE status = 'CONCLUIDA'`
  ).get().n;

  // compras pendentes devem vir da SOLICITAÇÃO
  const comprasPendentes = db.prepare(
    `SELECT COUNT(*) as n
     FROM solicitacoes_compra
     WHERE status IN ('aberta','cotacao','aprovada')`
  ).get().n;

  const itensEstoque = db.prepare(
    `SELECT COUNT(*) as n FROM estoque_itens`
  ).get().n;

  return {
    osAbertas,
    osAndamento,
    osConcluida,
    comprasPendentes,
    itensEstoque,
  };
};
