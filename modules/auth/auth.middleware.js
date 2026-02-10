// modules/auth/auth.middleware.js

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

// ✅ exige login
function requireLogin(req, res, next) {
  if (req.session?.user?.id) return next();

  req.flash("error", "Faça login para continuar.");
  return res.redirect("/login");
}

// ✅ exige perfil (RBAC)
// uso: requireRole(["compras","diretoria"])
// admin sempre passa
function requireRole(allowedRoles = []) {
  const allowed = Array.isArray(allowedRoles)
    ? allowedRoles.map(normalizeRole)
    : [normalizeRole(allowedRoles)];

  return (req, res, next) => {
    const user = req.session?.user;
    if (!user?.id) {
      req.flash("error", "Faça login para continuar.");
      return res.redirect("/login");
    }

    const role = normalizeRole(user.role);

    // ✅ admin passa em tudo
    if (role === "admin") return next();

    // ✅ se não foi passado allowedRoles, libera (somente logado)
    if (!allowed.length) return next();

    // ✅ se o role estiver na lista, libera
    if (allowed.includes(role)) return next();

    // 🚫 sem permissão
    req.flash("error", "Você não tem permissão para acessar esta área.");
    return res.redirect("/dashboard");
  };
}

module.exports = {
  requireLogin,
  requireRole,
};
