// modules/auth/auth.controller.js
const bcrypt = require("bcryptjs");
const authService = require("./auth.service");

exports.showLogin = (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.render("login", { title: "Login", layout: false });
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
    req.flash("error", "E-mail ou senha inválidos.");
    return res.redirect("/login");
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    req.flash("error", "E-mail ou senha inválidos.");
    return res.redirect("/login");
  }

  req.session.regenerate((err) => {
    if (err) {
      console.error("❌ regenerate:", err);
      req.flash("error", "Erro ao iniciar sessão.");
      return res.redirect("/login");
    }

    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };

    req.session.save((err2) => {
      if (err2) {
        console.error("❌ save:", err2);
        req.flash("error", "Erro ao salvar sessão.");
        return res.redirect("/login");
      }
      return res.redirect("/dashboard");
    });
  });
};

exports.logout = (req, res) => {
  const sidName = process.env.SESSION_COOKIE_NAME || "cg.sid";
  req.session?.destroy((err) => {
    if (err) console.error("❌ destroy:", err);
    res.clearCookie(sidName);
    return res.redirect("/login");
  });
};
