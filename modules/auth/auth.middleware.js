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
    if (allowedRoles.includes(user.role)) return next();
    req.flash("error", "Você não tem permissão para acessar esta área.");
    return res.redirect("/dashboard");
  };
}

module.exports = { requireLogin, requireRole };
