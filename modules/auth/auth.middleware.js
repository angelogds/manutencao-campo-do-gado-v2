// modules/auth/auth.middleware.js
function normRole(role) {
  return String(role || "").trim().toUpperCase();
}

function requireLogin(req, res, next) {
  if (req.session?.user) return next();
  req.flash("error", "Faça login para continuar.");
  return res.redirect("/auth/login");
}

/**
 * requireRole(["COMPRAS","DIRETORIA"...])
 * - ADMIN sempre passa
 * - compara role da sessão (case-insensitive)
 */
function requireRole(roles = []) {
  const allowed = (Array.isArray(roles) ? roles : [roles]).map(normRole);

  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      req.flash("error", "Faça login para continuar.");
      return res.redirect("/auth/login");
    }

    const role = normRole(user.role);
    if (role === "ADMIN") return next();

    if (allowed.length === 0) return next(); // sem regra -> libera
    if (allowed.includes(role)) return next();

    req.flash("error", "Você não tem permissão para acessar esta área.");
    return res.redirect("/dashboard");
  };
}

module.exports = { requireLogin, requireRole };
