// modules/dashboard/dashboard.controller.js
const dashboardService = require("./dashboard.service");

function index(req, res) {
  const data = dashboardService.getDashboardData();

  return res.render("dashboard/index", {
    title: "Painel",
    ...data,
  });
}

module.exports = { index };
