const fs = require("fs");
const path = require("path");
const service = require("./compras.service");
const STATUS = Object.freeze({
  ABERTA: "ABERTA",
  EM_COTACAO: "EM_COTACAO",
  COMPRADA: "COMPRADA",
  EM_RECEBIMENTO: "EM_RECEBIMENTO",
  RECEBIDA_PARCIAL: "RECEBIDA_PARCIAL",
  RECEBIDA_TOTAL: "RECEBIDA_TOTAL",
  FECHADA: "FECHADA",
  REABERTA: "REABERTA",
});

function lista(req, res) {
  const status = service.STATUS_COMPRAS.includes(req.query.status) ? req.query.status : STATUS.ABERTA;
  res.render("compras/solicitacoes/index", {
    title: "Compras",
    activeMenu: "compras",
    status,
    lista: service.listSolicitacoesPorStatus(status),
  });
}

function detalhe(req, res) {
  const sol = service.getSolicitacaoDetalhe(Number(req.params.id));
  if (!sol) return res.status(404).send("Solicitação não encontrada");
  res.render("compras/solicitacoes/show", { title: `Compras ${sol.numero}`, activeMenu: "compras", sol });
}

function assumir(req, res) {
  try {
    service.assumirSolicitacao(Number(req.params.id), req.session.user.id);
    req.flash("success", "Solicitação assumida e movida para EM_COTACAO.");
  } catch (e) {
    req.flash("error", e.message);
  }
  res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function atualizarDados(req, res) {
  try {
    service.atualizarDados(Number(req.params.id), req.body);
    req.flash("success", "Dados de compras atualizados.");
  } catch (e) {
    req.flash("error", e.message);
  }
  res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function marcarComprada(req, res) {
  try {
    service.marcarComprada(Number(req.params.id), req.session.user.id, req.body);
    req.flash("success", "Solicitação marcada como COMPRADA.");
  } catch (e) {
    req.flash("error", e.message);
  }
  res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function pdf(req, res) {
  const sol = service.getSolicitacaoDetalhe(Number(req.params.id));
  if (!sol) return res.status(404).send("Solicitação não encontrada");
  return service.gerarPdf(sol, res);
}

function uploadAnexo(req, res) {
  if (req.file?.path) {
    req.flash("success", "Arquivo enviado com sucesso.");
  } else {
    req.flash("error", "Nenhum arquivo foi enviado.");
  }
  return res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function downloadAnexo(req, res) {
  return res.status(501).send("Download de anexos indisponível no momento.");
}

function deleteAnexo(req, res) {
  req.flash("error", "Remoção de anexos indisponível no momento.");
  return res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

module.exports = { lista, detalhe, assumir, atualizarDados, marcarComprada, pdf, uploadAnexo, downloadAnexo, deleteAnexo };
