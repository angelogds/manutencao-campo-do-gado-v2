// modules/auth/auth.controller.js
const bcrypt = require("bcryptjs");
const authService = require("./auth.service");

exports.showLogin = (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");

  const rememberedEmail = req.cookies?.cg_remember_email || "";

  return res.render("auth/login", {
    title: "Login",
    lockout: null,
    attemptsLeft: null,
    rememberedEmail,
  });
};

exports.doLogin = (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    req.flash("error", "Informe e-mail e senha.");
    return res.redirect("/auth/login"); // ✅ corrigido
  }

  const g = req.authGuard;
  const { state } = g.getGuard(req, email);

  if (g.isLocked(state)) {
    return res.render("auth/login", {
      title: "Login",
      lockout: { remainingSeconds: g.remainingSeconds(state) },
      attemptsLeft: g.attemptsLeft(state),
      rememberedEmail: email,
    });
  }

  const user = authService.getUserByEmail(email);

  if (!user) {
    const st = g.fail(req, email);
    req.flash("error", "Usuário ou senha inválidos.");
    return res.render("auth/login", {
      title: "Login",
      lockout: g.isLocked(st)
        ? { remainingSeconds: g.remainingSeconds(st) }
        : null,
      attemptsLeft: g.attemptsLeft(st),
      rememberedEmail: email,
    });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);

  if (!ok) {
    const st = g.fail(req, email);
    req.flash("error", "Usuário ou senha inválidos.");
    return res.render("auth/login", {
      title: "Login",
      lockout: g.isLocked(st)
        ? { remainingSeconds: g.remainingSeconds(st) }
        : null,
      attemptsLeft: g.attemptsLeft(st),
      rememberedEmail: email,
    });
  }

  g.success(req, email);

  req.session.regenerate((err) => {
    if (err) {
      console.error("❌ Erro regenerate session:", err);
      req.flash("error", "Erro ao iniciar sessão. Tente novamente.");
      return res.redirect("/auth/login"); // ✅ corrigido
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    req.session.save((err2) => {
      if (err2) {
        console.error("❌ Erro session.save:", err2);
        req.flash("error", "Erro ao salvar sessão. Tente novamente.");
        return res.redirect("/auth/login"); // ✅ corrigido
      }

      return res.redirect("/dashboard"); // ✅ ok
    });
  });
};

exports.logout = (req, res) => {
  const sidName = process.env.SESSION_COOKIE_NAME || "cg.sid";

  req.session?.destroy((err) => {
    if (err) console.error("❌ Erro ao destruir sessão:", err);

    res.clearCookie(sidName);
    return res.redirect("/auth/login"); // ✅ corrigido
  });
};
