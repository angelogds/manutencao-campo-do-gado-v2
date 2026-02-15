// modules/dashboard/dashboard.controller.js
const service = require("./dashboard.service");

function index(req, res, next) {
  try {
    const cards = service.getCards();
    const plantao = service.getPlantaoAgora();

    return res.render("dashboard/index", {
      layout: "layout",
      title: "Painel Principal",
      activeMenu: "dashboard",
      cards,
      plantao,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { index };
