// modules/auth/auth.middleware.js

function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  req.flash("error", "Faça login para continuar.");
  return res.redirect("/login");
}

/**
 * requireRole(["COMPRAS","DIRECAO"...])
 * - ADMIN sempre passa
 * - Se allowedRoles vazio -> só exige login
 */
function requireRole(allowedRoles = []) {
  const allowed = (allowedRoles || []).map((r) => String(r).toUpperCase());

  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.flash("error", "Faça login para continuar.");
      return res.redirect("/login");
    }

    const role = String(req.session.user.role || "").toUpperCase();
    if (role === "ADMIN") return next();

    if (allowed.length === 0) return next();

    if (!allowed.includes(role)) {
      req.flash("error", "Você não tem permissão para acessar esta área.");
      return res.redirect("/dashboard");
    }

    return next();
  };
}

module.exports = { requireLogin, requireRole };
