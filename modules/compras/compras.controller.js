// modules/compras/compras.controller.js
const service = require("./compras.service");

function comprasIndex(req, res) {
  const lista = service.list();
  return res.render("compras/index", {
    title: "Compras",
    lista,
  });
}

function comprasNewForm(req, res) {
  return res.render("compras/nova", {
    title: "Nova Compra",
  });
}

function comprasCreate(req, res) {
  const { fornecedor, descricao, valor_total, status } = req.body;

  if (!descricao || !descricao.trim()) {
    req.flash("error", "Informe a descrição da compra.");
    return res.redirect("/compras/nova");
  }

  const id = service.create({
    fornecedor: (fornecedor || "").trim(),
    descricao: descricao.trim(),
    valor_total: valor_total ? Number(String(valor_total).replace(",", ".")) : 0,
    status: (status || "em_andamento").trim(),
    user_id: req.session?.user?.id || null,
  });

  req.flash("success", "Compra registrada com sucesso.");
  return res.redirect(`/compras/${id}`);
}

function comprasShow(req, res) {
  const id = Number(req.params.id);
  const compra = service.getById(id);

  if (!compra) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("compras/show", {
    title: `Compra #${compra.id}`,
    compra,
  });
}

module.exports = {
  comprasIndex,
  comprasNewForm,
  comprasCreate,
  comprasShow,
};
