// modules/dashboard/dashboard.controller.js
const service = require("./dashboard.service");

function index(req, res) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const cards = service.getCards();
  const osResumo = service.getOSResumoStatus();
  const osPainel = service.getOSPainel(page, 10);
  const historicoEquipamentos = service.getHistoricoEquipamentos(10);
  const motoresResumo = service.getMotoresResumoDashboard();
  const preventivas = service.getPreventivasDashboard();
  const escala = service.getEscalaPainelSemana() || service.getEscalaSemana();

  return res.render("dashboard/index", {
    title: "Painel",
    activeMenu: "dashboard",
    cards,
    osResumo,
    osPainel,
    historicoEquipamentos,
    motoresResumo,
    preventivas,
    escala,
  });
}

module.exports = { index };
