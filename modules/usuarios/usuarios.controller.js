const service = require("./usuarios.service");

const ROLES = ["ADMIN", "DIRECAO", "RH", "COMPRAS", "MANUTENCAO"];

exports.list = (req, res) => {
  const users = service.listUsers();
  return res.render("usuarios/index", { title: "Usuários", users, ROLES });
};

exports.newForm = (req, res) => {
  return res.render("usuarios/new", { title: "Novo usuário", ROLES });
};

exports.create = (req, res) => {
  const { name, email, role, password } = req.body;

  if (!name || !email || !role || !password) {
    req.flash("error", "Preencha nome, email, perfil e senha.");
    return res.redirect("/admin/users/new");
  }

  try {
    service.createUser({ name, email, role, password });
    req.flash("success", "Usuário criado com sucesso.");
    return res.redirect("/admin/users");
  } catch (e) {
    req.flash("error", e.message || "Erro ao criar usuário.");
    return res.redirect("/admin/users/new");
  }
};

exports.editForm = (req, res) => {
  const id = Number(req.params.id);
  const user = service.getUserById(id);
  if (!user) {
    req.flash("error", "Usuário não encontrado.");
    return res.redirect("/admin/users");
  }
  return res.render("usuarios/edit", { title: "Editar usuário", user, ROLES });
};

exports.update = (req, res) => {
  const id = Number(req.params.id);
  const { name, email, role } = req.body;

  if (!name || !email || !role) {
    req.flash("error", "Preencha nome, email e perfil.");
    return res.redirect(`/admin/users/${id}/edit`);
  }

  try {
    service.updateUser({ id, name, email, role });
    req.flash("success", "Usuário atualizado.");
    return res.redirect("/admin/users");
  } catch (e) {
    req.flash("error", e.message || "Erro ao atualizar usuário.");
    return res.redirect(`/admin/users/${id}/edit`);
  }
};

exports.resetPassword = (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword) {
    req.flash("error", "Informe a nova senha.");
    return res.redirect(`/admin/users/${id}/edit`);
  }

  try {
    service.resetPassword({ id, newPassword });
    req.flash("success", "Senha resetada com sucesso.");
    return res.redirect(`/admin/users/${id}/edit`);
  } catch (e) {
    req.flash("error", e.message || "Erro ao resetar senha.");
    return res.redirect(`/admin/users/${id}/edit`);
  }
};
