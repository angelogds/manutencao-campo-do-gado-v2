
exports.requireLogin = (req, res, next) => {
  if (!req.session?.user) return res.redirect("/login");
  next();
};

exports.requireRole = (roles = []) => {
  return (req, res, next) => {
    const role = req.session?.user?.role;
    if (!role) return res.status(403).send("Acesso negado");

    if (roles.includes(role) || role === "ADMIN") return next();

    return res.status(403).send("Acesso negado");
  };
};
