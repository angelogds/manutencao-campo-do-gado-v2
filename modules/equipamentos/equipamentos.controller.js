// modules/equipamentos/equipamentos.controller.js
const service = require("./equipamentos.service");

function equipIndex(req, res) {
  const lista = service.list();
  return res.render("equipamentos/index", {
    title: "Equipamentos",
    lista,
  });
}

function equipNewForm(req, res) {
  return res.render("equipamentos/novo", {
    title: "Novo Equipamento",
  });
}

function equipCreate(req, res) {
  const { codigo, nome, setor, tipo, criticidade, ativo } = req.body;

  if (!nome || !String(nome).trim()) {
    req.flash("error", "Informe o nome do equipamento.");
    return res.redirect("/equipamentos/novo");
  }

  const id = service.create({
    codigo,
    nome,
    setor,
    tipo,
    criticidade,
    ativo: ativo === "1" || ativo === "on" || ativo === 1,
  });

  req.flash("success", "Equipamento cadastrado com sucesso.");
  return res.redirect(`/equipamentos/${id}`);
}

function equipShow(req, res) {
  const id = Number(req.params.id);
  const equip = service.getById(id);

  if (!equip) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("equipamentos/show", {
    title: `Equipamento #${id}`,
    equip,
  });
}

function equipEditForm(req, res) {
  const id = Number(req.params.id);
  const equip = service.getById(id);

  if (!equip) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("equipamentos/editar", {
    title: `Editar Equipamento #${id}`,
    equip,
  });
}

function equipUpdate(req, res) {
  const id = Number(req.params.id);
  const { codigo, nome, setor, tipo, criticidade, ativo } = req.body;

  if (!nome || !String(nome).trim()) {
    req.flash("error", "Informe o nome do equipamento.");
    return res.redirect(`/equipamentos/${id}/editar`);
  }

  service.update(id, {
    codigo,
    nome,
    setor,
    tipo,
    criticidade,
    ativo: ativo === "1" || ativo === "on" || ativo === 1,
  });

  req.flash("success", "Equipamento atualizado com sucesso.");
  return res.redirect(`/equipamentos/${id}`);
}

module.exports = {
  equipIndex,
  equipNewForm,
  equipCreate,
  equipShow,
  equipEditForm,
  equipUpdate,
};
