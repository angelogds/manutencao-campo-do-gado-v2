const { findUserByEmail, verifyPassword } = require("./auth.service");

function showLogin(req, res) {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.render("auth/login", { title: "Login" });
}

async function handleLogin(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      req.flash("error", "Informe email e senha.");
      return res.redirect("/login");
    }

    const user = findUserByEmail(email);
    if (!user) {
      req.flash("error", "Usuário ou senha inválidos.");
      return res.redirect("/login");
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      req.flash("error", "Usuário ou senha inválidos.");
      return res.redirect("/login");
    }

    // salva só o necessário na sessão
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    req.flash("success", "Login realizado com sucesso.");
    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Erro no login:", err);
    req.flash("error", "Erro interno no login.");
    return res.redirect("/login");
  }
}

function handleLogout(req, res) {
  req.session.destroy(() => {
    res.redirect("/login");
  });
}

module.exports = {
  showLogin,
  handleLogin,
  handleLogout,
};
