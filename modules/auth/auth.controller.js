const { findUserByEmail, verifyPassword } = require("./auth.service");

function showLogin(req, res) {
  return res.render("auth/login", { title: "Login" });
}

function doLogin(req, res) {
  const { email, password } = req.body;

  const user = findUserByEmail(email);
  if (!user) {
    req.flash("error", "Email ou senha inválidos.");
    return res.redirect("/login");
  }

  const ok = verifyPassword(password, user.password_hash);
  if (!ok) {
    req.flash("error", "Email ou senha inválidos.");
    return res.redirect("/login");
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  req.flash("success", `Bem-vindo, ${user.name}!`);
  return res.redirect("/dashboard");
}

function doLogout(req, res) {
  req.session.destroy(() => {
    res.redirect("/login");
  });
}

module.exports = { showLogin, doLogin, doLogout };
