const service = require("./almoxarifado.service");

function index(req, res) {
  return res.render("almoxarifado/index", {
    title: "Almoxarifado",
    activeMenu: "almoxarifado",
    retiradas: service.listRetiradas(),
    funcionarios: service.listFuncionarios(),
    itens: service.listItensEstoque(),
    solicitacoes: service.listSolicitacoesAbertas(),
  });
}

function createFuncionario(req, res) {
  try {
    service.createFuncionario({ codigo: req.body.codigo, nome: req.body.nome });
    req.flash("success", "Funcionário cadastrado no almoxarifado.");
  } catch (e) {
    req.flash("error", `Erro ao cadastrar funcionário: ${e.message}`);
  }
  return res.redirect("/almoxarifado");
}

function createRetirada(req, res) {
  try {
    service.registrarRetirada({
      funcionario_id: req.body.funcionario_id,
      item_id: req.body.item_id,
      quantidade: Number(req.body.quantidade || 0),
      finalidade: req.body.finalidade,
      destino: req.body.destino,
      solicitacao_id: req.body.solicitacao_id,
      created_by: req.session?.user?.id || null,
    });
    req.flash("success", "Retirada registrada e estoque baixado.");
  } catch (e) {
    req.flash("error", `Erro na retirada: ${e.message}`);
  }
  return res.redirect("/almoxarifado");
}

module.exports = { index, createFuncionario, createRetirada };
