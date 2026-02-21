// modules/dashboard/dashboard.controller.js
const service = require("./dashboard.service");
const alertsHub = require('../alerts/alerts.hub');
const alertsService = require('../alerts/alerts.service');
const webPushService = require('../notifications/webpush.service');

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
  });

  req.flash("success", "Aviso publicado no mural.");
  return res.redirect("/dashboard");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

function createAviso(req, res) {
  req.flash("success", "Cadastro de avisos foi movido para o módulo Avisos.");
  return res.redirect("/avisos");
}

module.exports = { index, createAviso };
