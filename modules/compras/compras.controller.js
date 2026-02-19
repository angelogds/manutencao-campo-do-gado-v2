const service = require("./compras.service");

function comprasIndex(req, res) {
  const lista = service.listCompras();
  return res.render("compras/compras/index", {
    title: "Compras / Recebimento",
    activeMenu: "compras",
    lista,
  });
}

function comprasNewForm(req, res) {
  const solicitacaoSelecionada = req.query.solicitacao_id ? Number(req.query.solicitacao_id) : null;
  const solicitacoes = service.listSolicitacoesParaCompra();
  const estoqueItens = service.listEstoqueItensAtivos();

  return res.render("compras/compras/nova", {
    title: "Nova Compra",
    activeMenu: "compras",
    solicitacoes,
    estoqueItens,
    solicitacaoSelecionada,
  });
}

function comprasCreate(req, res) {
  const { solicitacao_id, fornecedor, observacao } = req.body;

  const toArr = (v) => (Array.isArray(v) ? v : [v]);
  const ids = toArr(req.body.itens_item_id);
  const descs = toArr(req.body.itens_descricao);
  const qtds = toArr(req.body.itens_qtd);
  const uns = toArr(req.body.itens_un);
  const custos = toArr(req.body.itens_custo);

  const itens = [];
  for (let i = 0; i < descs.length; i++) {
    const descricao = String(descs[i] || "").trim();
    if (!descricao) continue;

    itens.push({
      item_id: ids[i] ? Number(ids[i]) : null,
      descricao,
      quantidade: Number(qtds[i] || 1),
      unidade: String(uns[i] || "un"),
      custo_unit: Number(custos[i] || 0),
    });
  }

  if (!itens.length && !solicitacao_id) {
    req.flash("error", "Inclua pelo menos 1 item na compra.");
    return res.redirect("/compras/nova");
  }

  const compraId = service.createCompraFromSolicitacao(
    solicitacao_id ? Number(solicitacao_id) : null,
    { fornecedor: fornecedor || null, observacao: observacao || null, itens }
  );

  req.flash("success", `Compra #${compraId} criada.`);
  return res.redirect(`/compras/${compraId}`);
}

function comprasShow(req, res) {
  const id = Number(req.params.id);
  const compra = service.getCompraById(id);
  if (!compra) return res.status(404).send("Compra não encontrada");

  return res.render("compras/compras/show", {
    title: `Compra #${id}`,
    activeMenu: "compras",
    compra,
  });
}

function comprasUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  service.setCompraStatus(id, status);

  req.flash("success", "Status atualizado.");
  return res.redirect(`/compras/${id}`);
}

module.exports = {
  comprasIndex,
  comprasNewForm,
  comprasCreate,
  comprasShow,
  comprasUpdateStatus,
};
