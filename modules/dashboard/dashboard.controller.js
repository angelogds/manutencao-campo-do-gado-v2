const service = require("./dashboard.service");

exports.index = (req, res) => {
  // Se ainda não tiver métricas prontas, devolve zeros
  const cards = service.getCards?.() || {
    os_abertas: 0,
    compras_abertas: 0,
    itens_estoque: 0,
    equipamentos: 0,
  };

  return res.render("dashboard/index", {
    title: "Dashboard",
    cards,
  });
};
