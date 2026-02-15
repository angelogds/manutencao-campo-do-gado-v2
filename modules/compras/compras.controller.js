// modules/compras/compras.controller.js
const service = require("./compras.service");

// ===== SOLICITAÇÕES =====
function solicitacoesIndex(req, res) {
  const lista = service.listSolicitacoes();
  return res.render("compras/solicitacoes/index", {
    title: "Solicitações de Compra",
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
  const { solicitante, setor, observacao, itens_descricao, itens_qtd, itens_un } = req.body;

  const itens = [];
  const descArr = Array.isArray(itens_descricao) ? itens_descricao : [itens_descricao];
  const qtdArr = Array.isArray(itens_qtd) ? itens_qtd : [itens_qtd];
  const unArr = Array.isArray(itens_un) ? itens_un : [itens_un];

  for (let i = 0; i < descArr.length; i++) {
    const d = String(descArr[i] || "").trim();
    if (!d) continue;
    itens.push({
      descricao: d,
      quantidade: Number(qtdArr[i] || 1),
      unidade: String(unArr[i] || "un"),
    });
  }

  if (!itens.length) {
    req.flash("error", "Inclua pelo menos 1 item na solicitação.");
    return res.redirect("/compras/solicitacoes/nova");
  }

  const id = service.createSolicitacao({
    solicitante: solicitante || (req.session?.user?.name || "Usuário"),
    setor: setor || "Manutenção",
    observacao: observacao || null,
    itens,
  });

  req.flash("success", `Solicitação #${id} criada.`);
  return res.redirect(`/compras/solicitacoes/${id}`);
}

function solicitacoesShow(req, res) {
  const id = Number(req.params.id);
  const sol = service.getSolicitacaoById(id);
  if (!sol) return res.status(404).send("Solicitação não encontrada");

  return res.render("compras/solicitacoes/show", {
    title: `Solicitação #${id}`,
    activeMenu: "compras",
    sol,
  });
}

function solicitacoesUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  service.updateSolicitacaoStatus(id, status);

  // Se aprovada, pode criar compra automaticamente (opcional)
  if (status === "aprovada") {
    try {
      const compraId = service.createCompraFromSolicitacao(id);
      req.flash("success", `Solicitação aprovada. Compra #${compraId} criada.`);
      return res.redirect(`/compras/${compraId}`);
    } catch (e) {
      req.flash("error", `Solicitação aprovada, mas não foi possível criar compra: ${e.message}`);
      return res.redirect(`/compras/solicitacoes/${id}`);
    }
  }

  req.flash("success", "Status atualizado.");
  return res.redirect(`/compras/solicitacoes/${id}`);
}

// ===== COMPRAS =====
function comprasIndex(req, res) {
  const lista = service.listCompras();
  return res.render("compras/compras/index", {
    title: "Compras / Recebimento",
    activeMenu: "compras",
    lista,
  });
}

function comprasNewForm(req, res) {
  const solicitacoes = service.listSolicitacoes().filter((s) =>
    ["aprovada", "cotacao", "aberta"].includes(String(s.status || ""))
  );

  const estoqueItens = service.listEstoqueItensAtivos();

  return res.render("compras/compras/nova", {
    title: "Nova Compra",
    activeMenu: "compras",
    solicitacoes,
    estoqueItens,
  });
}

function comprasCreate(req, res) {
  const { solicitacao_id, fornecedor, observacao } = req.body;

  // Itens
  const itens_item_id = req.body.itens_item_id;
  const itens_descricao = req.body.itens_descricao;
  const itens_qtd = req.body.itens_qtd;
  const itens_un = req.body.itens_un;
  const itens_custo = req.body.itens_custo;

  const toArr = (v) => (Array.isArray(v) ? v : [v]);

  const ids = toArr(itens_item_id);
  const descs = toArr(itens_descricao);
  const qtds = toArr(itens_qtd);
  const uns = toArr(itens_un);
  const custos = toArr(itens_custo);

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

  if (!itens.length) {
    req.flash("error", "Inclua pelo menos 1 item na compra.");
    return res.redirect("/compras/nova");
  }

  // Cria compra “solta” ou ligada a solicitação
  const compraId = service.createCompraFromSolicitacao(
    solicitacao_id ? Number(solicitacao_id) : null,
    {
      fornecedor: fornecedor || null,
      observacao: observacao || null,
      itens,
    }
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

  // ✅ Se status = "recebida" -> dá entrada no estoque automaticamente
  service.setCompraStatus(id, status);

  req.flash("success", "Status atualizado.");
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
