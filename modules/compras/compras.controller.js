// modules/compras/compras.controller.js
const service = require("./compras.service");

// ========== COMPRAS ==========
exports.comprasIndex = (req, res) => {
  const lista = service.listCompras();
  return res.render("compras/index", {
    title: "Compras",
    activeMenu: "compras",
    lista,
  });
};

exports.comprasNewForm = (req, res) => {
  const solicitacoesAprovadas = service.listSolicitacoesAprovadas();
  return res.render("compras/nova", {
    title: "Nova Compra",
    activeMenu: "compras",
    solicitacoesAprovadas,
  });
};

exports.comprasCreate = (req, res) => {
  const { solicitacao_id, fornecedor, numero_nf, valor_total, observacao } = req.body;

  const id = service.createCompra({
    solicitacao_id: solicitacao_id ? Number(solicitacao_id) : null,
    fornecedor,
    numero_nf,
    valor_total,
    observacao,
    criado_por: req.session?.user?.id || null,
  });

  req.flash("success", "Compra registrada com sucesso.");
  return res.redirect(`/compras/${id}`);
};

exports.comprasShow = (req, res) => {
  const id = Number(req.params.id);
  const compra = service.getCompraById(id);

  if (!compra) return res.status(404).send("Compra não encontrada");
  return res.render("compras/show", {
    title: `Compra #${id}`,
    activeMenu: "compras",
    compra,
  });
};

exports.comprasUpdateStatus = (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  service.updateCompraStatus(id, status, req.session?.user?.id || null);

  req.flash("success", "Status da compra atualizado.");
  return res.redirect(`/compras/${id}`);
};

// ========== SOLICITAÇÕES ==========
exports.solicitacoesIndex = (req, res) => {
  const lista = service.listSolicitacoes();
  return res.render("compras/solicitacoes/index", {
    title: "Solicitações de Compra",
    activeMenu: "compras",
    lista,
  });
};

exports.solicitacoesNewForm = (req, res) => {
  return res.render("compras/solicitacoes/nova", {
    title: "Nova Solicitação",
    activeMenu: "compras",
  });
};

exports.solicitacoesCreate = (req, res) => {
  const { titulo, descricao, urgencia } = req.body;

  if (!titulo || !String(titulo).trim()) {
    req.flash("error", "Informe o título da solicitação.");
    return res.redirect("/compras/solicitacoes/nova");
  }

  const id = service.createSolicitacao({
    titulo,
    descricao,
    urgencia: urgencia || "NORMAL",
    criado_por: req.session?.user?.id || null,
  });

  req.flash("success", "Solicitação criada com sucesso.");
  return res.redirect(`/compras/solicitacoes/${id}`);
};

exports.solicitacoesShow = (req, res) => {
  const id = Number(req.params.id);
  const solicitacao = service.getSolicitacaoById(id);

  if (!solicitacao) return res.status(404).send("Solicitação não encontrada");
  return res.render("compras/solicitacoes/show", {
    title: `Solicitação #${id}`,
    activeMenu: "compras",
    solicitacao,
  });
};

exports.solicitacoesUpdateStatus = (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  service.updateSolicitacaoStatus(id, status, req.session?.user?.id || null);

  req.flash("success", "Status da solicitação atualizado.");
  return res.redirect(`/compras/solicitacoes/${id}`);
};
