
// modules/auth/auth.controller.js
const bcrypt = require("bcryptjs");
const authService = require("./auth.service");

exports.showLogin = (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");

  // ✅ login.ejs é HTML completo -> não usar layout do ejs-mate
  return res.render("login", {
    title: "Login • Campo do Gado",
    layout: false,// modules/auth/auth.controller.js
const bcrypt = require("bcryptjs");
const authService = require("./auth.service");

function renderLogin(req, res, opts = {}) {
  return res.render("login", {
    title: "Login • Campo do Gado",
    layout: false, // login é HTML completo
    lockout: null,
    attemptsLeft: null,
    rememberedEmail: "",
    ...opts,
  });
}

exports.showLogin = (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return renderLogin(req, res);
};

exports.doLogin = (req, res) => {
  const guard = req.authGuard;

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const rememberMe = String(req.body?.remember_me || "0") === "1";

  // ✅ DEBUG TEMPORÁRIO (pode remover depois)
  console.log("🔐 POST /login", { email, hasPassword: !!password, rememberMe });

  if (!email || !password) {
    req.flash("error", "Informe email e senha.");
    return renderLogin(req, res, { rememberedEmail: email });
  }

  const { state } = guard.getGuard(req, email);
  if (guard.isLocked(state)) {
    return renderLogin(req, res, {
      lockout: { remainingSeconds: guard.remainingSeconds(state) },
      attemptsLeft: guard.attemptsLeft(state),
      rememberedEmail: email,
    });
  }

  const user = authService.getUserByEmail(email);

  // ✅ DEBUG TEMPORÁRIO
  console.log("👤 user found?", !!user, user ? { id: user.id, email: user.email, role: user.role } : null);

  if (!user) {
    const st = guard.fail(req, email);
    req.flash("error", "E-mail ou senha inválidos.");
    return renderLogin(req, res, {
      lockout: guard.isLocked(st) ? { remainingSeconds: guard.remainingSeconds(st) } : null,
      attemptsLeft: guard.attemptsLeft(st),
      rememberedEmail: email,
    });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);

  // ✅ DEBUG TEMPORÁRIO
  console.log("🔑 bcrypt ok?", ok);

  if (!ok) {
    const st = guard.fail(req, email);
    req.flash("error", "E-mail ou senha inválidos.");
    return renderLogin(req, res, {
      lockout: guard.isLocked(st) ? { remainingSeconds: guard.remainingSeconds(st) } : null,
      attemptsLeft: guard.attemptsLeft(st),
      rememberedEmail: email,
    });
  }

  guard.success(req, email);

  req.session.regenerate((err) => {
    if (err) {
      console.error("❌ Erro regenerate session:", err);
      req.flash("error", "Erro ao iniciar sessão. Tente novamente.");
      return renderLogin(req, res, { rememberedEmail: email });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 15; // 15 dias
    } else {
      req.session.cookie.expires = false;
    }

    req.session.save((err2) => {
      if (err2) {
        console.error("❌ Erro session.save:", err2);
        req.flash("error", "Erro ao salvar sessão. Tente novamente.");
        return renderLogin(req, res, { rememberedEmail: email });
      }
      return res.redirect("/dashboard");
    });
  });
};

exports.logout = (req, res) => {
  const sidName = process.env.SESSION_COOKIE_NAME || "cg.sid";
  req.session?.destroy((err) => {
    if (err) console.error("❌ Erro ao destruir sessão:", err);
    res.clearCookie(sidName);
    return res.redirect("/login");
  });
};
    lockout: null,
    attemptsLeft: null,
    rememberedEmail: "",
  });
};

exports.doLogin = (req, res) => {
  const guard = req.authGuard;

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const rememberMe = String(req.body?.remember_me || "0") === "1";

  if (!email || !password) {
    req.flash("error", "Informe email e senha.");
    return res.status(400).render("login", {
      title: "Login • Campo do Gado",
      layout: false,
      lockout: null,
      attemptsLeft: null,
      rememberedEmail: email,
    });
  }

  // ✅ verifica bloqueio
  const { state } = guard.getGuard(req, email);
  if (guard.isLocked(state)) {
    return res.status(429).render("login", {
      title: "Login • Campo do Gado",
      layout: false,
      lockout: { remainingSeconds: guard.remainingSeconds(state) },
      attemptsLeft: guard.attemptsLeft(state),
      rememberedEmail: email,
    });
  }

  const user = authService.getUserByEmail(email);

  if (!user) {
    const st = guard.fail(req, email);
    req.flash("error", "E-mail ou senha inválidos.");

    return res.status(401).render("login", {
      title: "Login • Campo do Gado",
      layout: false,
      lockout: guard.isLocked(st) ? { remainingSeconds: guard.remainingSeconds(st) } : null,
      attemptsLeft: guard.attemptsLeft(st),
      rememberedEmail: email,
    });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);

  if (!ok) {
    const st = guard.fail(req, email);
    req.flash("error", "E-mail ou senha inválidos.");

    return res.status(401).render("login", {
      title: "Login • Campo do Gado",
      layout: false,
      lockout: guard.isLocked(st) ? { remainingSeconds: guard.remainingSeconds(st) } : null,
      attemptsLeft: guard.attemptsLeft(st),
      rememberedEmail: email,
    });
  }

  // ✅ sucesso -> zera guard
  guard.success(req, email);

  // ✅ evita sessão antiga reaproveitada
  req.session.regenerate((err) => {
    if (err) {
      console.error("❌ Erro regenerate session:", err);
      req.flash("error", "Erro ao iniciar sessão. Tente novamente.");
      return res.status(500).render("login", {
        title: "Login • Campo do Gado",
        layout: false,
        lockout: null,
        attemptsLeft: null,
        rememberedEmail: email,
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // ✅ “lembrar de mim” = cookie mais longo
    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 15; // 15 dias
    } else {
      req.session.cookie.expires = false;
    }

    req.session.save((err2) => {
      if (err2) {
        console.error("❌ Erro session.save:", err2);
        req.flash("error", "Erro ao salvar sessão. Tente novamente.");
        return res.status(500).render("login", {
          title: "Login • Campo do Gado",
          layout: false,
          lockout: null,
          attemptsLeft: null,
          rememberedEmail: email,
        });
      }

      return res.redirect("/dashboard");
    });
  });
};

exports.logout = (req, res) => {
  const sidName = process.env.SESSION_COOKIE_NAME || "cg.sid";
  req.session?.destroy((err) => {
    if (err) console.error("❌ Erro ao destruir sessão:", err);
    res.clearCookie(sidName);
    return res.redirect("/login");
  });
};
