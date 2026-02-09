// modules/dashboard/dashboard.controller.js
const db = require("../../database/db");

// Padrão: sempre exporta o nome que a rota vai usar
exports.dashboardIndex = (req, res) => {
  // Se você ainda não quiser usar números no dashboard, pode deixar fixo
  // mas aqui já deixei consultando as views do banco (070_dashboard_views.sql)

  const getTotal = (viewName) => {
    try {
      const row = db.prepare(`SELECT total FROM ${viewName}`).get();
      return row?.total ?? 0;
    } catch (e) {
      // se a view não existir ainda, não derruba
      return 0;
    }
  };

  const cards = {
    osAbertas: getTotal("vw_dashboard_os_abertas"),
    comprasAbertas: getTotal("vw_dashboard_compras_abertas"),
    itensAbaixoMin: getTotal("vw_dashboard_itens_abaixo_minimo"),
  };

  return res.render("dashboard/index", {
    title: "Dashboard",
    cards,
  });
};
