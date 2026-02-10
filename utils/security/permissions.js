// utils/security/permissions.js

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function getUserRoles(user) {
  const roles = new Set();

  // role único (legacy)
  if (user?.role) roles.add(normalizeRole(user.role));

  // array de roles
  if (Array.isArray(user?.roles)) {
    for (const r of user.roles) roles.add(normalizeRole(r));
  }

  // perfil (caso você use user.perfil)
  if (user?.perfil) roles.add(normalizeRole(user.perfil));

  return roles;
}

function hasAnyRole(user, allowedRoles = []) {
  if (!allowedRoles || allowedRoles.length === 0) return true; // se não exigir, libera
  const userRoles = getUserRoles(user);
  const allowed = new Set(allowedRoles.map(normalizeRole));

  for (const r of userRoles) {
    if (allowed.has(r)) return true;
  }
  return false;
}

module.exports = { hasAnyRole, normalizeRole, getUserRoles };
