// modules/dashboard/dashboard.controller.js
const dashboardService = require("./dashboard.service");

function dashboardIndex(req, res) {
  const counters = dashboardService.getCounters();

  return res.render("dashboard/index", {
    title: "Dashboard",
    counters,
  });
}

module.exports = { dashboardIndex };
