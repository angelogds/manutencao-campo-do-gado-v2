// modules/auth/auth.middleware.js
exports.requireAuth = (req, res, next) => {
  if (req.session?.user) return next();
  req.flash("error", "Faça login para continuar.");
  return res.redirect("/login");
};

exports.requireRole = (roles = []) => {
  return (req, res, next) => {
    const role = req.session?.user?.role;
    if (role && roles.includes(role)) return next();
    req.flash("error", "Acesso negado.");
    return res.redirect("/dashboard");
  };
};
