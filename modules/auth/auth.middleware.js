exports.requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.flash("error", "Faça login para continuar.");
    return res.redirect("/login");
  }
  next();
};

exports.requireAdmin = (req, res, next) => {
  if (!req.session.user) {
    req.flash("error", "Faça login para continuar.");
    return res.redirect("/login");
  }

  if (req.session.user.role !== "ADMIN") {
    req.flash("error", "Você não tem permissão para acessar esta área.");
    return res.redirect("/dashboard");
  }

  next();
};
