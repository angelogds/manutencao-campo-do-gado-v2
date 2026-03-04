const fs = require("fs");
const path = require("path");
const service = require("./compras.service");

function lista(req, res) {
  const status = service.STATUS_COMPRAS.includes(req.query.status) ? req.query.status : "ABERTA";
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
  } catch (e) { req.flash("error", e.message); }
  res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function atualizarDados(req, res) {
  try {
    service.atualizarDados(Number(req.params.id), req.body);
    req.flash("success", "Dados de compras atualizados.");
  } catch (e) { req.flash("error", e.message); }
  res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function marcarComprada(req, res) {
  try {
    service.marcarComprada(Number(req.params.id), req.session.user.id, req.body);
    req.flash("success", "Solicitação marcada como COMPRADA.");
  } catch (e) { req.flash("error", e.message); }
  res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function pdf(req, res) {
  try {
    service.ensureCotacaoStarted(Number(req.params.id), req.session.user.id);
    const sol = service.getSolicitacaoDetalhe(Number(req.params.id));
    if (!sol) return res.status(404).send("Solicitação não encontrada");
    return service.gerarPdf(sol, res);
  } catch (e) {
    req.flash("error", e.message);
    return res.redirect(`/compras/solicitacoes/${req.params.id}`);
  }
}

function uploadAnexo(req, res) {
  if (!req.file) {
    req.flash("error", "Selecione um arquivo PDF/JPG/PNG de até 8MB.");
    return res.redirect(`/compras/solicitacoes/${req.params.id}`);
  }
  try {
    service.addAnexo({ solicitacaoId: Number(req.params.id), file: req.file, userId: req.session.user.id });
    req.flash("success", "Anexo enviado com sucesso.");
  } catch (e) {
    req.flash("error", e.message);
  }
  return res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function downloadAnexo(req, res) {
  const solicitacaoId = Number(req.params.id);
  const anexoId = Number(req.params.anexoId);
  const anexo = service.getAnexo(anexoId, solicitacaoId);
  if (!anexo) return res.status(404).send("Anexo não encontrado");
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
  return res.download(path.join(uploadsDir, anexo.filename), anexo.original_name || anexo.filename);
}

function deleteAnexo(req, res) {
  const solicitacaoId = Number(req.params.id);
  const anexoId = Number(req.params.anexoId);
  const anexo = service.getAnexo(anexoId, solicitacaoId);
  if (!anexo) {
    req.flash("error", "Anexo não encontrado.");
    return res.redirect(`/compras/solicitacoes/${req.params.id}`);
  }
  try {
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, anexo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    service.deleteAnexo(anexoId, solicitacaoId);
    req.flash("success", "Anexo removido.");
  } catch (e) { req.flash("error", e.message); }
  return res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

module.exports = { lista, detalhe, assumir, atualizarDados, marcarComprada, pdf, uploadAnexo, downloadAnexo, deleteAnexo };
