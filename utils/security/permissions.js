// utils/security/permissions.js

// Permissões por role (o que cada perfil pode acessar)
const ROLE_PERMS = {
  admin: ["*"],

  diretoria: ["dashboard", "equipamentos", "os", "compras", "estoque", "usuarios", "preventivas", "escala"],
  rh: ["dashboard", "os", "equipamentos", "usuarios"],

  compras: ["dashboard", "compras", "estoque"],
  almoxarifado: ["dashboard", "estoque", "compras"],

  producao: ["dashboard", "os", "equipamentos"],
  mecanico: ["dashboard", "os", "equipamentos", "preventivas", "escala"],
};

// Retorna true se user tem role
function getRole(user) {
  return String(user?.role || "").toLowerCase().trim();
}

function canAccess(user, feature) {
  const role = getRole(user);
  if (!role) return false;

  const perms = ROLE_PERMS[role] || [];
  if (perms.includes("*")) return true;

  return perms.includes(feature);
}

function canAny(user, features = []) {
  return features.some((f) => canAccess(user, f));
}

module.exports = {
  ROLE_PERMS,
  canAccess,
  canAny,
};
