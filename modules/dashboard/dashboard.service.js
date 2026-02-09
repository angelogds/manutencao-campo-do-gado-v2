const db = require("../../database/db");

exports.getCounters = () => {
  // Se algum módulo ainda não tiver tabela, é melhor falhar aqui do que no dashboard inteiro.
  // MAS: assumindo que suas migrations já criaram tudo.

  const osAbertas = db.prepare(`SELECT COUNT(*) as n FROM os WHERE status = 'ABERTA'`).get().n;
  const osAndamento = db.prepare(`SELECT COUNT(*) as n FROM os WHERE status = 'ANDAMENTO'`).get().n;
  const osConcluida = db.prepare(`SELECT COUNT(*) as n FROM os WHERE status = 'CONCLUIDA'`).get().n;

  const comprasPendentes = db
    .prepare(`SELECT COUNT(*) as n FROM compras WHERE status IN ('ABERTA','COTANDO','APROVADA')`)
    .get().n;

  const itensEstoque = db.prepare(`SELECT COUNT(*) as n FROM estoque_itens`).get().n;

  return {
    osAbertas,
    osAndamento,
    osConcluida,
    comprasPendentes,
    itensEstoque,
  };
};
