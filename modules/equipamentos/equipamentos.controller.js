// modules/equipamentos/equipamentos.controller.js
const service = require("./equipamentos.service");

function equipIndex(req, res) {
  const lista = service.list();
  return res.render("equipamentos/index", { title: "Equipamentos", lista });
}

function equipNewForm(req, res) {
  return res.render("equipamentos/novo", { title: "Novo Equipamento" });
}

function equipCreate(req, res) {
  const { codigo, nome, setor, tipo, criticidade, ativo } = req.body;

  if (!nome || !nome.trim()) {
    req.flash("error", "Informe o nome do equipamento.");
    return res.redirect("/equipamentos/novo");
  }

  try {
    const id = service.create({
      codigo: (codigo || "").trim() || null,
      nome: nome.trim(),
      setor: (setor || "").trim() || null,
      tipo: (tipo || "").trim() || null,
      criticidade: (criticidade || "media").trim(),
      ativo: ativo === "0" ? 0 : 1,
    });

    req.flash("success", "Equipamento criado com sucesso.");
    return res.redirect(`/equipamentos/${id}`);
  } catch (e) {
    // erro mais comum: código duplicado
    if (String(e.message).toLowerCase().includes("unique")) {
      req.flash("error", "Código já existe. Use outro código.");
      return res.redirect("/equipamentos/novo");
    }
    console.error("❌ [equipamentos] erro ao criar:", e);
    req.flash("error", "Erro ao criar equipamento.");
    return res.redirect("/equipamentos/novo");
  }
}

function equipShow(req, res) {
  const id = Number(req.params.id);
  const equipamento = service.getById(id);

  if (!equipamento) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("equipamentos/show", {
    title: `Equipamento #${id}`,
    equipamento,
  });
}

function equipEditForm(req, res) {
  const id = Number(req.params.id);
  const equipamento = service.getById(id);

  if (!equipamento) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("equipamentos/editar", {
    title: `Editar Equipamento #${id}`,
    equipamento,
  });
}

function equipUpdate(req, res) {
  const id = Number(req.params.id);
  const { codigo, nome, setor, tipo, criticidade, ativo } = req.body;

  if (!nome || !nome.trim()) {
    req.flash("error", "Informe o nome do equipamento.");
    return res.redirect(`/equipamentos/${id}/editar`);
  }

  try {
    service.update(id, {
      codigo: (codigo || "").trim() || null,
      nome: nome.trim(),
      setor: (setor || "").trim() || null,
      tipo: (tipo || "").trim() || null,
      criticidade: (criticidade || "media").trim(),
      ativo: ativo === "0" ? 0 : 1,
    });

    req.flash("success", "Equipamento atualizado.");
    return res.redirect(`/equipamentos/${id}`);
  } catch (e) {
    if (String(e.message).toLowerCase().includes("unique")) {
      req.flash("error", "Código já existe. Use outro código.");
      return res.redirect(`/equipamentos/${id}/editar`);
    }
    console.error("❌ [equipamentos] erro ao atualizar:", e);
    req.flash("error", "Erro ao atualizar equipamento.");
    return res.redirect(`/equipamentos/${id}/editar`);
  }
}

module.exports = {
  equipIndex,
  equipNewForm,
  equipCreate,
  equipShow,
  equipEditForm,
  equipUpdate,
};
