// modules/estoque/estoque.controller.js
const service = require("./estoque.service");

function estoqueIndex(req, res) {
  const q = (req.query.q || "").toString().trim();
  const onlyBelow = (req.query.below || "") === "1";

  const lista = service.listItens({ q, onlyBelowMin: onlyBelow });

  const cards = service.getCards();

  return res.render("estoque/index", {
    title: "Estoque",
    activeMenu: "estoque",
    lista,
    cards,
    q,
    onlyBelow,
  });
}

function estoqueNewForm(req, res) {
  return res.render("estoque/novo", {
    title: "Novo Item",
    activeMenu: "estoque",
  });
}

function estoqueCreate(req, res) {
  const { codigo, nome, unidade, estoque_min, custo_unit } = req.body;

  if (!nome || !String(nome).trim()) {
    req.flash("error", "Informe o nome do item.");
    return res.redirect("/estoque/novo");
  }

  try {
    const id = service.createItem({
      codigo: (codigo || "").trim(),
      nome: String(nome).trim(),
      unidade: (unidade || "un").trim(),
      estoque_min: estoque_min ? Number(String(estoque_min).replace(",", ".")) : 0,
      custo_unit: custo_unit ? Number(String(custo_unit).replace(",", ".")) : 0,
    });

    req.flash("success", "Item criado com sucesso.");
    return res.redirect(`/estoque/${id}`);
  } catch (e) {
    req.flash("error", `Erro ao criar item: ${e.message}`);
    return res.redirect("/estoque/novo");
  }
}

function estoqueShow(req, res) {
  const id = Number(req.params.id);

  const item = service.getItemById(id);
  if (!item) {
    return res.status(404).render("errors/404", {
      title: "Não encontrado",
      activeMenu: "estoque",
    });
  }

  const movimentos = service.listMovimentosByItem(id);

  return res.render("estoque/show", {
    title: `Item #${id}`,
    activeMenu: "estoque",
    item,
    movimentos,
  });
}

function estoqueMovCreate(req, res) {
  const itemId = Number(req.params.id);
  const { tipo, quantidade, custo_unit, origem, observacao } = req.body;

  if (!tipo || !String(tipo).trim()) {
    req.flash("error", "Informe o tipo de movimentação.");
    return res.redirect(`/estoque/${itemId}`);
  }

  const qtd = quantidade ? Number(String(quantidade).replace(",", ".")) : 0;
  if (!qtd || qtd <= 0) {
    req.flash("error", "Informe uma quantidade válida.");
    return res.redirect(`/estoque/${itemId}`);
  }

  try {
    service.createMovimento({
      item_id: itemId,
      tipo: String(tipo).trim().toLowerCase(), // entrada|saida|ajuste
      quantidade: qtd,
      custo_unit: custo_unit ? Number(String(custo_unit).replace(",", ".")) : null,
      origem: (origem || "").trim(),
      observacao: (observacao || "").trim(),
    });

    req.flash("success", "Movimentação registrada.");
    return res.redirect(`/estoque/${itemId}`);
  } catch (e) {
    req.flash("error", `Erro ao registrar movimentação: ${e.message}`);
    return res.redirect(`/estoque/${itemId}`);
  }
}

module.exports = {
  estoqueIndex,
  estoqueNewForm,
  estoqueCreate,
  estoqueShow,
  estoqueMovCreate,
};
