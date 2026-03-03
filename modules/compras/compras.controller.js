const service = require("./compras.service");

function lista(req, res) {
  res.render("compras/lista", { title: "Compras", activeMenu: "compras", lista: service.listSolicitacoes(), status: req.query.status || "" });
}

function detalhe(req, res) {
  const sol = service.getSolicitacao(Number(req.params.id));
  if (!sol) return res.status(404).send("Solicitação não encontrada");
  res.render("compras/detalhe", { title: `Compras ${sol.numero}`, activeMenu: "compras", sol });
}

function assumir(req, res) {
  try { service.assumirSolicitacao(Number(req.params.id), req.session.user.id); req.flash("success", "Solicitação em cotação."); }
  catch (e) { req.flash("error", e.message); }
  res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function atualizarDados(req, res) {
  service.atualizarDados(Number(req.params.id), req.body);
  req.flash("success", "Dados de compras atualizados.");
  res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function marcarComprada(req, res) {
  try { service.marcarComprada(Number(req.params.id)); req.flash("success", "Marcada como comprada."); }
  catch (e) { req.flash("error", e.message); }
  res.redirect(`/compras/solicitacoes/${req.params.id}`);
}

function pdf(req, res) {
  const sol = service.getSolicitacao(Number(req.params.id));
  if (!sol) return res.status(404).send("Solicitação não encontrada");
  return service.gerarPdf(sol, res);
}

module.exports = { lista, detalhe, assumir, atualizarDados, marcarComprada, pdf };
