const service = require("./dashboard.service");

function index(req, res) {
  const cards = service.getCards();
  const blocks = service.getBlocks();

  return res.render("dashboard/index", {
    title: "Painel Principal",
    activeMenu: "dashboard",
    cards,
    blocks,
  });
}

module.exports = { index };
