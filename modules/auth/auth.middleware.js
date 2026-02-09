function requireLogin(req, res, next) {
  if (req.session?.user) return next();
  req.flash("error", "Faça login para continuar.");
  return res.redirect("/login");
}

function requireRole(roles = []) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      req.flash("error", "Faça login para continuar.");
      return res.redirect("/login");
    }
    if (roles.length === 0) return next();
    if (roles.includes(user.role)) return next();

    req.flash("error", "Você não tem permissão para acessar essa área.");
    return res.redirect("/dashboard");
  };
}

module.exports = { requireLogin, requireRole };
