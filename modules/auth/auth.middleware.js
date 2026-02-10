// modules/auth/auth.middleware.js
const { hasAnyRole } = require("../../utils/security/permissions");

function requireLogin(req, res, next) {
  if (req.session?.user) return next();
  req.flash("error", "Faça login para continuar.");
  return res.redirect("/login");
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    const user = req.session?.user;

    if (!user) {
      req.flash("error", "Faça login para continuar.");
      return res.redirect("/login");
    }

    // ✅ ADMIN entra em tudo (mesmo se allowedRoles não tiver ADMIN)
    const role = String(user.role || "").toUpperCase();
    if (role === "ADMIN") return next();

    if (hasAnyRole(user, allowedRoles)) return next();

    req.flash("error", "Você não tem permissão para acessar esta área.");
    return res.redirect("/dashboard");
  };
}

module.exports = { requireLogin, requireRole };
