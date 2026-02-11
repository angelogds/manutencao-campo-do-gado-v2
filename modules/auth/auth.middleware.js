// modules/auth/auth.middleware.js

function requireLogin(req, res, next) {
  if (req.session?.user) return next();
  req.flash("error", "Faça login para continuar.");
  return res.redirect("/login");
}

// rolesAllowed pode ser: ["ADMIN","RH"] etc
function requireRole(rolesAllowed = []) {
  const allowed = (rolesAllowed || []).map((r) => String(r || "").toUpperCase());

  return (req, res, next) => {
    const role = String(req.session?.user?.role || "").toUpperCase();

    // Admin sempre passa
    if (role === "ADMIN") return next();

    if (!allowed.length) return next(); // se não definir roles, deixa passar

    if (allowed.includes(role)) return next();

    req.flash("error", "Você não tem permissão para acessar esta área.");
    return res.redirect("/dashboard");
  };
}

module.exports = { requireLogin, requireRole };
