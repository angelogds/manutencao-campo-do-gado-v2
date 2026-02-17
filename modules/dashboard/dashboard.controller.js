// modules/dashboard/dashboard.controller.js
const service = require("./dashboard.service");
const db = require("../../database/db");

function index(req, res, next) {
  try {
    const cards = service.getCards();
    const plantao = service.getPlantaoAgora();

    const motorRebobCount = db.prepare(`
      SELECT COUNT(*) as total
      FROM motores
      WHERE status = 'ENVIADO_REBOB'
    `).get().total;

    return res.render("dashboard/index", {
      layout: "layout",
      title: "Painel Principal",
      activeMenu: "dashboard",
      cards,
      plantao,
      motorRebobCount
    });

  } catch (err) {
    return next(err);
  }
}

module.exports = { index };
