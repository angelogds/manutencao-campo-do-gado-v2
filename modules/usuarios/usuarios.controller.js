// modules/usuarios/usuarios.controller.js
const service = require("./usuarios.service");

const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "diretoria", label: "Diretoria" },
  { key: "rh", label: "RH" },
  { key: "compras", label: "Compras" },
  { key: "producao", label: "Produção" },
  { key: "mecanico", label: "Mecânico" },
  { key: "almoxarifado", label: "Almoxarifado" },
];

function list(req, res) {
  res.locals.activeMenu = "usuarios";
  const q = (req.query.q || "").trim();
  const role = (req.query.role || "").trim();

  const lista = service.list({ q, role });

  return res.render("usuarios/index", {
    title: "Usuários",
    layout: "layout",
    lista,
    q,
    role,
    ROLES,
  });
}

function newForm(req, res) {
  res.locals.activeMenu = "usuarios";
  return res.render("usuarios/novo", {
    title: "Novo Usuário",
    layout: "layout",
    ROLES,
  });
}

function create(req, res) {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const role = (req.body.role || "").trim();
  const password = (req.body.password || "").trim();

  if (!name || !email || !role || !password) {
    req.flash("error", "Preencha nome, e-mail, perfil e senha.");
    return res.redirect("/usuarios/novo");
  }

  try {
    service.create({ name, email, role, password });
    req.flash("success", "Usuário criado com sucesso.");
    return res.redirect("/usuarios");
  } catch (e) {
    req.flash("error", e.message || "Erro ao criar usuário.");
    return res.redirect("/usuarios/novo");
  }
}

function editForm(req, res) {
  res.locals.activeMenu = "usuarios";
  const id = Number(req.params.id);
  const user = service.getById(id);

  if (!user) return res.status(404).render("errors/404", { title: "Não encontrado" });

  return res.render("usuarios/editar", {
    title: `Editar Usuário #${id}`,
    layout: "layout",
    user,
    ROLES,
  });
}

function update(req, res) {
  const id = Number(req.params.id);
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const role = (req.body.role || "").trim();

  if (!name || !email || !role) {
    req.flash("error", "Preencha nome, e-mail e perfil.");
    return res.redirect(`/usuarios/${id}/editar`);
  }

  try {
    service.update(id, { name, email, role });
    req.flash("success", "Usuário atualizado com sucesso.");
    return res.redirect("/usuarios");
  } catch (e) {
    req.flash("error", e.message || "Erro ao atualizar usuário.");
    return res.redirect(`/usuarios/${id}/editar`);
  }
}

function resetPassword(req, res) {
  const id = Number(req.params.id);
  const password = (req.body.password || "").trim();

  if (!password) {
    req.flash("error", "Informe a nova senha.");
    return res.redirect(`/usuarios/${id}/editar`);
  }

  try {
    service.resetPassword(id, password);
    req.flash("success", "Senha resetada com sucesso.");
    return res.redirect(`/usuarios/${id}/editar`);
  } catch (e) {
    req.flash("error", e.message || "Erro ao resetar senha.");
    return res.redirect(`/usuarios/${id}/editar`);
  }
}

module.exports = { list, newForm, create, editForm, update, resetPassword };
