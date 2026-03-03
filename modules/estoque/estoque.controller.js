const service = require("./estoque.service");

function index(req, res) { res.render("estoque/index", { title: "Estoque", activeMenu: "estoque", cards: service.dashboard() }); }
function itens(req, res) { res.render("estoque/itens", { title: "Itens", activeMenu: "estoque", itens: service.listItens() }); }
function novoItem(req, res) { res.render("estoque/novo_item", { title: "Novo Item", activeMenu: "estoque", categorias: service.listCategorias(), locais: service.listLocais() }); }
function criarItem(req, res) { try { const id = service.createItem(req.body); req.flash("success", "Item criado."); return res.redirect(`/estoque/itens/${id}`);} catch (e) { req.flash("error", e.message); return res.redirect("/estoque/itens/novo"); } }
function detalheItem(req, res) { const item = service.getItem(Number(req.params.id)); if (!item) return res.status(404).send("Item não encontrado"); res.render("estoque/show", { title: item.nome, activeMenu: "estoque", item }); }
function categorias(req, res) { res.render("estoque/categorias", { title: "Categorias", activeMenu: "estoque", categorias: service.listCategorias() }); }
function criarCategoria(req, res) { service.createCategoria(req.body); req.flash("success", "Categoria criada."); res.redirect("/estoque/categorias"); }
function locais(req, res) { res.render("estoque/locais", { title: "Locais", activeMenu: "estoque", locais: service.listLocais() }); }
function criarLocal(req, res) { service.createLocal(req.body); req.flash("success", "Local criado."); res.redirect("/estoque/locais"); }
function movimentos(req, res) { res.render("estoque/movimentos", { title: "Movimentos", activeMenu: "estoque", movimentos: service.listMovimentos() }); }
function saidaNova(req, res) { res.render("estoque/saida_nova", { title: "Registrar saída", activeMenu: "estoque", itens: service.listItens() }); }

module.exports = { index, itens, novoItem, criarItem, detalheItem, categorias, criarCategoria, locais, criarLocal, movimentos, saidaNova };
