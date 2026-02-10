// modules/auth/auth.middleware.js
const { canAccess } = require("../../utils/security/permissions");

function requireLogin(req, res, next) {
  if (req.session?.user) return next();
  req.flash("error", "Faça login para continuar.");
  return res.redirect("/login");
}

// feature = "compras" | "estoque" | "os" etc
function requireFeature(feature) {
  return (req, res, next) => {
    const user = req.session?.user;

    if (!user) {
      req.flash("error", "Faça login para continuar.");
      return res.redirect("/login");
    }

    if (canAccess(user, feature)) return next();

    req.flash("error", "Você não tem permissão para acessar esta área.");
    return res.redirect("/dashboard");
  };
}

module.exports = { requireLogin, requireFeature };
