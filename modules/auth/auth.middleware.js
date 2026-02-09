const { hasAnyRole } = require("../../utils/security/permissions");

function requireLogin(req, res, next) {
  if (req.session?.user) return next();
  req.flash("error", "Faça login para continuar.");
  return res.redirect("/login");
}

/**
 * Exige pelo menos 1 dos perfis permitidos.
 * admin sempre passa.
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    const user = req.session?.user;

    if (!user) {
      req.flash("error", "Faça login para continuar.");
      return res.redirect("/login");
    }

    if (hasAnyRole(user, allowedRoles)) return next();

    req.flash("error", "Você não tem permissão para acessar esta área.");
    return res.redirect("/dashboard");
  };
}

/**
 * Alias para deixar mais claro no código
 */
const requireAnyRole = requireRole;

module.exports = { requireLogin, requireRole, requireAnyRole };
