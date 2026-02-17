// modules/dashboard/dashboard.controller.js
const service = require("./dashboard.service");

function index(req, res) {
  const cards = service.getCards();
  const preventivas = service.getPreventivasOrdenadas();
  const escala = service.getEscalaSemana();

  res.render("dashboard/index", {
    title: "Dashboard",
    activeMenu: "dashboard",
    cards,
    preventivas,
    escala,
  });
}

module.exports = { index };
