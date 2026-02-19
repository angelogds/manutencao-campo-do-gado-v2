// modules/dashboard/dashboard.controller.js
const service = require("./dashboard.service");

function index(req, res) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const cards = service.getCards();
  const osResumo = service.getOSResumoStatus();
  const osPainel = service.getOSPainel(page, 10);
  const historicoEquipamentos = service.getHistoricoEquipamentos(10);
  const motoresResumo = service.getMotoresResumoDashboard();
  const comprasResumo = service.getComprasResumoDashboard();
  const estoqueResumo = service.getEstoqueResumoDashboard();
  const demandasResumo = service.getDemandasResumoDashboard();
  const preventivas = service.getPreventivasDashboard();
  const escala = service.getEscalaPainelSemana() || service.getEscalaSemana();
  const avisos = service.getAvisosDashboard(12);

  return res.render("dashboard/index", {
    title: "Painel",
    activeMenu: "dashboard",
    cards,
    osResumo,
    osPainel,
    historicoEquipamentos,
    motoresResumo,
    comprasResumo,
    estoqueResumo,
    demandasResumo,
    preventivas,
    escala,
    avisos,
  });
}

module.exports = { index };
