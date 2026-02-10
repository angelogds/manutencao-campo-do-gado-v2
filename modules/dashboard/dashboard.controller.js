// modules/dashboard/dashboard.controller.js
const service = require("./dashboard.service");

function index(req, res) {
  const cards = service.getCards();

  return res.render("dashboard/index", {
    title: "Dashboard",
    activeMenu: "dashboard",
    cards,
  });
}

module.exports = { index };
