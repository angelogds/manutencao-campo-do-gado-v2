// modules/estoque/estoque.controller.js
const service = require("./estoque.service");

function estoqueIndex(req, res) {
  const itens = service.listItensComSaldo();
  return res.render("estoque/index", { title: "Estoque", itens });
}

function estoqueNewForm(req, res) {
  return res.render("estoque/novo", { title: "Novo Item" });
}

function estoqueCreate(req, res) {
  const { codigo, nome, unidade, estoque_min, custo_unit, ativo } = req.body;

  if (!nome || !nome.trim()) {
    req.flash("error", "Informe o nome do item.");
    return res.redirect("/estoque/novo");
  }

  const id = service.createItem({
    codigo: (codigo || "").trim() || null,
    nome: nome.trim(),
    unidade: (unidade || "un").trim(),
    estoque_min: estoque_min ? Number(String(estoque_min).replace(",", ".")) : 0,
    custo_unit: custo_unit ? Number(String(custo_unit).replace(",", ".")) : 0,
    ativo: ativo === "0" ? 0 : 1,
  });

  req.flash("success", "Item criado com sucesso.");
  return res.redirect(`/estoque/${id}`);
}

function estoqueShow(req, res) {
  const id = Number(req.params.id);
  const item = service.getItemDetalhe(id);

  if (!item) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("estoque/show", { title: `Item #${id}`, item });
}

function estoqueMovCreate(req, res) {
  const itemId = Number(req.params.id);
  const { tipo, quantidade, custo_unit, origem, referencia_id, observacao } = req.body;

  if (!tipo || !["entrada", "saida", "ajuste"].includes(tipo)) {
    req.flash("error", "Tipo inválido. Use: entrada/saida/ajuste.");
    return res.redirect(`/estoque/${itemId}`);
  }

  const qtd = quantidade ? Number(String(quantidade).replace(",", ".")) : 0;
  if (!Number.isFinite(qtd) || qtd <= 0) {
    req.flash("error", "Quantidade inválida.");
    return res.redirect(`/estoque/${itemId}`);
  }

  service.addMovimento({
    item_id: itemId,
    tipo,
    quantidade: qtd,
    custo_unit: custo_unit ? Number(String(custo_unit).replace(",", ".")) : null,
    origem: (origem || "").trim() || null,
    referencia_id: referencia_id ? Number(referencia_id) : null,
    observacao: (observacao || "").trim() || null,
  });

  req.flash("success", "Movimento lançado com sucesso.");
  return res.redirect(`/estoque/${itemId}`);
}

module.exports = {
  estoqueIndex,
  estoqueNewForm,
  estoqueCreate,
  estoqueShow,
  estoqueMovCreate,
};
