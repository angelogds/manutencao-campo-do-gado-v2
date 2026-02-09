const service = require("./dashboard.service");

exports.index = (req, res) => {
  const counters = service.getCounters();

  return res.render("dashboard/index", {
    title: "Dashboard",
    counters,
  });
};
