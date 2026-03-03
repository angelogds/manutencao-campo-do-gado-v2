const service = require("./almoxarifado.service");

function index(req, res) {
  res.locals.activeMenu = "almoxarifado";
  res.locals.almoxTab = "retiradas";

  return res.render("almoxarifado/index", {
    title: "Almoxarifado - Retiradas",
    activeMenu: "almoxarifado",
    retiradas: service.listRetiradas(),
    funcionarios: service.listFuncionarios(),
    itens: service.listItensEstoque(),
    solicitacoes: service.listSolicitacoesRelacionadas(),
  });
}

function createRetirada(req, res) {
  try {
    service.registrarRetirada({
      ...req.body,
      created_by: req.session?.user?.id || null,
    });
    req.flash("success", "Retirada registrada e estoque baixado.");
  } catch (e) {
    req.flash("error", `Erro na retirada: ${e.message}`);
  }

  return res.redirect("/almoxarifado");
}

function recebimentosIndex(req, res) {
  res.locals.activeMenu = "almoxarifado";
  res.locals.almoxTab = "recebimentos";

  return res.render("almoxarifado/recebimentos", {
    title: "Almoxarifado - Recebimentos",
    activeMenu: "almoxarifado",
    status: req.query.status || "",
    lista: service.listRecebimentos(),
  });
}

function iniciarRecebimento(req, res) {
  try {
    service.iniciarRecebimento(Number(req.params.id), req.session?.user?.id || null);
    req.flash("success", "Recebimento iniciado com sucesso.");
  } catch (e) {
    req.flash("error", e.message);
  }

  return res.redirect(`/almoxarifado/solicitacoes/${req.params.id}/conferir`);
}

function conferir(req, res) {
  res.locals.activeMenu = "almoxarifado";
  res.locals.almoxTab = "recebimentos";

  const sol = service.getSolicitacao(Number(req.params.id));
  if (!sol) return res.status(404).send("Solicitação não encontrada.");

  return res.render("almoxarifado/conferir", {
    title: `Conferência ${sol.numero}`,
    activeMenu: "almoxarifado",
    sol,
  });
}

function receberItem(req, res) {
  try {
    service.receberItem({
      solicitacaoId: Number(req.params.id),
      itemId: Number(req.params.itemId),
      qtdAgora: req.body.qtd_recebida_agora,
      observacao: req.body.observacao_item,
      userId: req.session?.user?.id || null,
    });
    req.flash("success", "Item recebido e movimentação gerada.");
  } catch (e) {
    req.flash("error", e.message);
  }

  return res.redirect(`/almoxarifado/solicitacoes/${req.params.id}/conferir`);
}

function finalizar(req, res) {
  try {
    service.finalizarRecebimento(Number(req.params.id));
    req.flash("success", "Recebimento finalizado com sucesso.");
  } catch (e) {
    req.flash("error", e.message);
  }

  return res.redirect("/almoxarifado/recebimentos");
}

function fechar(req, res) {
  try {
    service.fechar(Number(req.params.id));
    req.flash("success", "Solicitação fechada.");
  } catch (e) {
    req.flash("error", e.message);
  }

  return res.redirect("/almoxarifado/recebimentos");
}

function reabrir(req, res) {
  try {
    service.reabrir(Number(req.params.id));
    req.flash("success", "Solicitação reaberta.");
  } catch (e) {
    req.flash("error", e.message);
  }

  return res.redirect("/almoxarifado/recebimentos");
}

module.exports = {
  index,
  createRetirada,
  recebimentosIndex,
  iniciarRecebimento,
  conferir,
  receberItem,
  finalizar,
  fechar,
  reabrir,
};
