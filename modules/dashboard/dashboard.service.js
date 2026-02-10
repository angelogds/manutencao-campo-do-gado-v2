// modules/dashboard/dashboard.service.js
const db = require("../../database/db");

function getOne(sql) {
  try {
    return db.prepare(sql).get();
  } catch (e) {
    // se view/tabela não existe ainda, não derruba dashboard
    return { total: 0 };
  }
}

function getCards() {
  // views criadas na 070_dashboard_views.sql
  const os = getOne("SELECT total FROM vw_dashboard_os_abertas");
  const compras = getOne("SELECT total FROM vw_dashboard_compras_abertas");
  const itensMin = getOne("SELECT total FROM vw_dashboard_itens_abaixo_minimo");

  // extras: estoque_itens e equipamentos (pode não existir em alguns bancos)
  const itens = getOne("SELECT COUNT(*) as total FROM estoque_itens");
  const equips = getOne("SELECT COUNT(*) as total FROM equipamentos");

  return {
    os_abertas: Number(os?.total || 0),
    compras_abertas: Number(compras?.total || 0),
    itens_abaixo_minimo: Number(itensMin?.total || 0),
    itens_estoque: Number(itens?.total || 0),
    equipamentos: Number(equips?.total || 0),
  };
}

module.exports = {
  getCards,
};
