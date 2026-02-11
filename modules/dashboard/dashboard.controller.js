const service = require("./dashboard.service");

function index(req, res) {
  const cards = service.getCards();
  const plantao = service.getPlantaoAgora();

  return res.render("dashboard/index", {
    layout: "layout",
    title: "Painel Principal",
    activeMenu: "dashboard",
    cards,
    plantao,
  });
}

module.exports = { index };
