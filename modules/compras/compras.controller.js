// modules/compras/compras.controller.js
const service = require("./compras.service");

/**
 * SOLICITAÇÕES
 */
function solicitacoesIndex(req, res) {
  const lista = service.listSolicitacoes();
  return res.render("compras/solicitacoes/index", {
    title: "Solicitações de Compra",
    lista,
  });
}

function solicitacoesNewForm(req, res) {
  return res.render("compras/solicitacoes/nova", {
    title: "Nova Solicitação",
  });
}

function solicitacoesCreate(req, res) {
  const { solicitante, setor, observacao, item_descricao, item_quantidade, item_unidade } = req.body;

  if (!item_descricao || !item_descricao.trim()) {
    req.flash("error", "Informe ao menos 1 item (descrição).");
    return res.redirect("/solicitacoes/nova");
  }

  const solicitacaoId = service.createSolicitacao({
    solicitante: (solicitante || "").trim(),
    setor: (setor || "").trim(),
    observacao: (observacao || "").trim(),
    itens: [
      {
        descricao: item_descricao.trim(),
        quantidade: item_quantidade ? Number(String(item_quantidade).replace(",", ".")) : 1,
        unidade: (item_unidade || "un").trim(),
      },
    ],
  });

  req.flash("success", "Solicitação criada com sucesso.");
  return res.redirect(`/solicitacoes/${solicitacaoId}`);
}

function solicitacoesShow(req, res) {
  const id = Number(req.params.id);
  const solicitacao = service.getSolicitacaoById(id);

  if (!solicitacao) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("compras/solicitacoes/show", {
    title: `Solicitação #${id}`,
    solicitacao,
  });
}

function solicitacoesUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  service.updateSolicitacaoStatus(id, (status || "").trim());
  req.flash("success", "Status da solicitação atualizado.");
  return res.redirect(`/solicitacoes/${id}`);
}

/**
 * COMPRAS
 */
function comprasIndex(req, res) {
  const lista = service.listCompras();
  return res.render("compras/compras/index", {
    title: "Compras",
    lista,
  });
}

function comprasNewForm(req, res) {
  // lista de solicitações para vincular
  const solicitacoes = service.listSolicitacoes();
  return res.render("compras/compras/nova", {
    title: "Nova Compra",
    solicitacoes,
  });
}

function comprasCreate(req, res) {
  const { solicitacao_id, fornecedor, status, data_compra, observacao } = req.body;

  const compraId = service.createCompra({
    solicitacao_id: solicitacao_id ? Number(solicitacao_id) : null,
    fornecedor: (fornecedor || "").trim(),
    status: (status || "em_andamento").trim(),
    data_compra: (data_compra || "").trim(),
    observacao: (observacao || "").trim(),
  });

  req.flash("success", "Compra criada com sucesso.");
  return res.redirect(`/compras/${compraId}`);
}

function comprasShow(req, res) {
  const id = Number(req.params.id);
  const compra = service.getCompraById(id);

  if (!compra) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("compras/compras/show", {
    title: `Compra #${id}`,
    compra,
  });
}

function comprasUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  service.updateCompraStatus(id, (status || "").trim());
  req.flash("success", "Status da compra atualizado.");
  return res.redirect(`/compras/${id}`);
}

module.exports = {
  // solicitações
  solicitacoesIndex,
  solicitacoesNewForm,
  solicitacoesCreate,
  solicitacoesShow,
  solicitacoesUpdateStatus,
  // compras
  comprasIndex,
  comprasNewForm,
  comprasCreate,
  comprasShow,
  comprasUpdateStatus,
};
