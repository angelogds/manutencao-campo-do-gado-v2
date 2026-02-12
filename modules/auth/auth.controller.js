
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
    return res.redirect("/login");
  }

  const user = authService.getUserByEmail(email);

  if (!user) {
    req.flash("error", "Usuário não encontrado.");
    return res.redirect("/login");
  }

  const ok = bcrypt.compareSync(password, user.password_hash);

  if (!ok) {
    req.flash("error", "Senha inválida.");
    return res.redirect("/login");
  }

  // ✅ evita sessão antiga reaproveitada
  req.session.regenerate((err) => {
    if (err) {
      console.error("❌ Erro regenerate session:", err);
      req.flash("error", "Erro ao iniciar sessão. Tente novamente.");
      return res.redirect("/login");
    }

    // ✅ salva na sessão (inclui role!)
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // ✅ garante persistência antes do redirect
    req.session.save((err2) => {
      if (err2) {
        console.error("❌ Erro session.save:", err2);
        req.flash("error", "Erro ao salvar sessão. Tente novamente.");
        return res.redirect("/login");
      }
      return res.redirect("/dashboard");
    });
  });
};

exports.logout = (req, res) => {
  // limpa e destrói sessão
  const sidName = "cg.sid"; // se você usa outro nome, ajuste aqui
  req.session?.destroy((err) => {
    if (err) console.error("❌ Erro ao destruir sessão:", err);
    res.clearCookie(sidName);
    return res.redirect("/login");
  });
};
