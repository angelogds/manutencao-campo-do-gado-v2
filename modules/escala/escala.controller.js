const service = require("./escala.service");

function index(req, res) {
  const hoje = service.getEscalaHoje();

  return res.render("escala/index", {
    title: "Escala de Trabalho",
    activeMenu: "escala",
    escala: hoje,
  });
}

module.exports = {
  index,
};
