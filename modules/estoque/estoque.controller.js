const service = require("./estoque.service");

function index(req, res) {
  res.locals.activeMenu = "estoque";
  res.locals.estoqueTab = "itens";

  return res.render("estoque/index", {
    title: "Estoque - Itens",
    activeMenu: "estoque",
    cards: service.dashboard(),
    itens: service.listItens(),
  });
}


function itens(req, res) {
  res.locals.activeMenu = "estoque";
  res.locals.estoqueTab = "itens";
  return res.render("estoque/itens", {
    title: "Estoque - Itens",
    activeMenu: "estoque",
    itens: service.listItens(),
  });
}

function novoItem(req, res) {
  res.locals.activeMenu = "estoque";
  res.locals.estoqueTab = "itens";
  return res.render("estoque/novo_item", {
    title: "Estoque - Novo item",
    activeMenu: "estoque",
    categorias: service.listCategorias(),
    locais: service.listLocais(),
  });
}

function criarItem(req, res) {
  try {
    const id = service.createItem(req.body);
    req.flash("success", "Item criado com sucesso.");
    return res.redirect(`/estoque/itens/${id}`);
  } catch (e) {
    req.flash("error", e.message);
    return res.redirect("/estoque/itens/novo");
  }
}

function showItem(req, res) {
  res.locals.activeMenu = "estoque";
  res.locals.estoqueTab = "itens";
  const item = service.getItemDetalhe(req.params.id);
  if (!item) return res.status(404).send("Item não encontrado.");
  return res.render("estoque/show", {
    title: `Item ${item.nome}`,
    activeMenu: "estoque",
    item,
    movimentos: service.listMovimentosByItem(req.params.id),
  });
}

function categoriasIndex(req, res) {
  res.locals.activeMenu = "estoque";
  res.locals.estoqueTab = "categorias";

  return res.render("estoque/categorias", {
    title: "Estoque - Categorias",
    activeMenu: "estoque",
    categorias: service.listCategorias(),
  });
}

function categoriasCreate(req, res) {
  try {
    service.createCategoria(req.body);
    req.flash("success", "Categoria criada com sucesso.");
  } catch (e) {
    req.flash("error", `Não foi possível criar a categoria: ${e.message}`);
  }
  return res.redirect("/estoque/categorias");
}

function locaisIndex(req, res) {
  res.locals.activeMenu = "estoque";
  res.locals.estoqueTab = "locais";

  return res.render("estoque/locais", {
    title: "Estoque - Locais",
    activeMenu: "estoque",
    locais: service.listLocais(),
  });
}

function locaisCreate(req, res) {
  try {
    service.createLocal(req.body);
    req.flash("success", "Local criado com sucesso.");
  } catch (e) {
    req.flash("error", `Não foi possível criar o local: ${e.message}`);
  }
  return res.redirect("/estoque/locais");
}

function movimentosIndex(req, res) {
  res.locals.activeMenu = "estoque";
  res.locals.estoqueTab = "movimentos";

  return res.render("estoque/movimentos", {
    title: "Estoque - Movimentos",
    activeMenu: "estoque",
    movimentos: service.listMovimentos({ tipo: req.query.tipo, item_id: req.query.item_id }),
    itens: service.listItens(),
    filtros: { tipo: req.query.tipo || "", item_id: req.query.item_id || "" },
  });
}

function saidaNewForm(req, res) {
  res.locals.activeMenu = "estoque";
  res.locals.estoqueTab = "saida";

  return res.render("estoque/saida_nova", {
    title: "Estoque - Registrar saída",
    activeMenu: "estoque",
    itens: service.listItens(),
  });
}

function saidaCreate(req, res) {
  try {
    service.registrarSaida({ ...req.body, usuario_id: req.session?.user?.id || null });
    req.flash("success", "Saída registrada e saldo atualizado.");
  } catch (e) {
    req.flash("error", `Erro ao registrar saída: ${e.message}`);
  }
  return res.redirect("/estoque/saidas/nova");
}

module.exports = {
  index,
  itens,
  novoItem,
  criarItem,
  showItem,
  categoriasIndex,
  categoriasCreate,
  locaisIndex,
  locaisCreate,
  movimentosIndex,
  saidaNewForm,
  saidaCreate,
};
