const service = require("./escala.service");

function index(req, res) {
  const hoje = service.getHoje();

  return res.render("escala/index", {
    title: "Escala",
    activeMenu: "escala",
    hoje,
  });
}

module.exports = { index };
