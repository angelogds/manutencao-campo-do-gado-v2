// modules/auth/auth.controller.js
const bcrypt = require("bcryptjs");
const authService = require("./auth.service");

exports.showLogin = (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.render("auth/login", { title: "Login" });
};

exports.doLogin = (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    req.flash("error", "Informe email e senha.");
    return res.redirect("/auth/login");
  }

  const user = authService.getUserByEmail(email);

  if (!user) {
    req.flash("error", "Usuário não encontrado.");
    return res.redirect("/auth/login");
  }

  const ok = bcrypt.compareSync(password, user.password_hash);

  if (!ok) {
    req.flash("error", "Senha inválida.");
    return res.redirect("/auth/login");
  }

  req.session.regenerate((err) => {
    if (err) {
      console.error("❌ Erro regenerate session:", err);
      req.flash("error", "Erro ao iniciar sessão.");
      return res.redirect("/auth/login");
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    req.session.save(() => {
      return res.redirect("/dashboard");
    });
  });
};

exports.logout = (req, res) => {
  req.session?.destroy(() => {
    res.clearCookie("cg.sid");
    return res.redirect("/auth/login");
  });
};
