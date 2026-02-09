// utils/security/permissions.js

// Roles oficiais do sistema (não precisa exportar todos, mas ajuda)
const ROLES = Object.freeze({
  ADMIN: "admin",
  DIRETORIA: "diretoria",
  RH: "rh",
  COMPRAS: "compras",
  ALMOX: "almoxarifado",
  MANUTENCAO: "manutencao",
  PRODUCAO: "producao",
});

/**
 * Retorna role do usuário (string) com fallback seguro
 */
function getUserRole(user) {
  return user?.role ? String(user.role).trim() : "";
}

/**
 * true se user.role estiver em allowedRoles
 */
function hasAnyRole(user, allowedRoles = []) {
  const role = getUserRole(user);
  if (!role) return false;

  // admin sempre pode tudo
  if (role === ROLES.ADMIN) return true;

  const allowed = (allowedRoles || []).map((r) => String(r).trim());
  return allowed.includes(role);
}

/**
 * true se user.role for exatamente roleName
 */
function hasRole(user, roleName) {
  const role = getUserRole(user);
  if (!role) return false;
  if (role === ROLES.ADMIN) return true;
  return role === String(roleName).trim();
}

module.exports = { ROLES, getUserRole, hasAnyRole, hasRole };
