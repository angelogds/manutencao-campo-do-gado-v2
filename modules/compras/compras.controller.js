// modules/compras/compras.controller.js
const service = require("./compras.service");

/**
 * SOLICITAÇÕES (Inbox)
 */
function solicitacoesIndex(req, res) {
  const lista = service.listSolicitacoes();
  return res.render("compras/solicitacoes/index", {
    title: "Compras (Inbox)",
    activeMenu: "compras",
    lista,
  });
}

function solicitacoesNewForm(req, res) {
  return res.render("compras/solicitacoes/nova", {
    title: "Nova Solicitação",
    activeMenu: "compras",
  });
}

function solicitacoesCreate(req, res) {
  const {
    solicitante,
    setor,
    observacao,
    item_descricao,
    item_quantidade,
    item_unidade,
  } = req.body;

  if (!item_descricao || !String(item_descricao).trim()) {
    req.flash("error", "Informe ao menos 1 item (descrição).");
    return res.redirect("/solicitacoes/nova");
  }

  const solicitacaoId = service.createSolicitacao({
    solicitante: String(solicitante || "").trim(),
    setor: String(setor || "").trim(),
    observacao: String(observacao || "").trim(),
    itens: [
      {
        descricao: String(item_descricao).trim(),
        quantidade: item_quantidade
          ? Number(String(item_quantidade).replace(",", "."))
          : 1,
        unidade: String(item_unidade || "un").trim(),
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
    return res.status(404).render("errors/404", {
      title: "Não encontrado",
      activeMenu: "compras",
    });
  }

  return res.render("compras/solicitacoes/show", {
    title: `Solicitação #${id}`,
    activeMenu: "compras",
    solicitacao,
  });
}

function solicitacoesUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  service.updateSolicitacaoStatus(id, String(status || "").trim());
  req.flash("success", "Status da solicitação atualizado.");
  return res.redirect(`/solicitacoes/${id}`);
}

/**
 * COMPRAS (recebimento)
 */
function comprasIndex(req, res) {
  const lista = service.listCompras();
  return res.render("compras/compras/index", {
    title: "Compras",
    activeMenu: "compras",
    lista,
  });
}

function comprasNewForm(req, res) {
  const solicitacoes = service.listSolicitacoes();
  return res.render("compras/compras/nova", {
    title: "Nova Compra",
    activeMenu: "compras",
    solicitacoes,
  });
}

function comprasCreate(req, res) {
  const { solicitacao_id, fornecedor, status, data_compra, observacao } =
    req.body;

  const compraId = service.createCompra({
    solicitacao_id: solicitacao_id ? Number(solicitacao_id) : null,
    fornecedor: String(fornecedor || "").trim(),
    status: String(status || "em_andamento").trim(),
    data_compra: String(data_compra || "").trim(),
    observacao: String(observacao || "").trim(),
  });

  req.flash("success", "Compra criada com sucesso.");
  return res.redirect(`/compras/${compraId}`);
}

function comprasShow(req, res) {
  const id = Number(req.params.id);
  const compra = service.getCompraById(id);

  if (!compra) {
    return res.status(404).render("errors/404", {
      title: "Não encontrado",
      activeMenu: "compras",
    });
  }

  return res.render("compras/compras/show", {
    title: `Compra #${id}`,
    activeMenu: "compras",
    compra,
  });
}

function comprasUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  service.updateCompraStatus(id, String(status || "").trim());
  req.flash("success", "Status da compra atualizado.");
  return res.redirect(`/compras/${id}`);
}

module.exports = {
  solicitacoesIndex,
  solicitacoesNewForm,
  solicitacoesCreate,
  solicitacoesShow,
  solicitacoesUpdateStatus,

  comprasIndex,
  comprasNewForm,
  comprasCreate,
  comprasShow,
  comprasUpdateStatus,
};
