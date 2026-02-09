const bcrypt = require("bcryptjs");
const authService = require("./auth.service");

exports.showLogin = (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("auth/login", { title: "Login" });
};

exports.doLogin = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash("error", "Informe email e senha.");
    return res.redirect("/login");
  }

  const user = authService.getUserByEmail(email.trim().toLowerCase());

  if (!user) {
    req.flash("error", "Usuário não encontrado.");
    return res.redirect("/login");
  }

  const ok = bcrypt.compareSync(password, user.password_hash);

  if (!ok) {
    req.flash("error", "Senha inválida.");
    return res.redirect("/login");
  }

  // ✅ SALVA NA SESSÃO
  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  // ✅ GARANTE PERSISTÊNCIA
  req.session.save(() => {
    res.redirect("/dashboard");
  });
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
};
