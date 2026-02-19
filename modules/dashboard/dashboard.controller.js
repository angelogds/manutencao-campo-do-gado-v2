// modules/dashboard/dashboard.controller.js
const service = require("./dashboard.service");

function canManageAvisos(user) {
  const role = String(user?.role || "").toUpperCase();
  return ["ADMIN", "DIRECAO", "DIRETORIA", "ENCARREGADO_PRODUCAO", "RH"].includes(role);
}

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
    canManageAvisos: canManageAvisos(req.session?.user),
  });
}

function createAviso(req, res) {
  if (!canManageAvisos(req.session?.user)) {
    req.flash("error", "Você não tem permissão para publicar avisos.");
    return res.redirect("/dashboard");
  }

  const { titulo, mensagem, colaborador_nome, data_referencia } = req.body || {};
  if (!String(titulo || "").trim() || !String(mensagem || "").trim()) {
    req.flash("error", "Informe título e mensagem do aviso.");
    return res.redirect("/dashboard");
  }

  service.createAviso({
    titulo: String(titulo).trim(),
    mensagem: String(mensagem).trim(),
    colaborador_nome: String(colaborador_nome || "").trim() || null,
    data_referencia: String(data_referencia || "").trim() || null,
    createdBy: req.session?.user?.id || null,
  });

  req.flash("success", "Aviso publicado no mural.");
  return res.redirect("/dashboard");
}

module.exports = { index, createAviso };
