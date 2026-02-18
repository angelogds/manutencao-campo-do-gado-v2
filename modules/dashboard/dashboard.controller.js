// modules/dashboard/dashboard.controller.js
const dashboardService = require("./dashboard.service");

function index(req, res) {
  const data = dashboardService.getDashboardData();

  res.locals.activeMenu = "dashboard";
  return res.render("dashboard/index", {
    title: "Dashboard",
    ...data,
  });
}

module.exports = { index };
