const ROLES = {
  ADMIN: "ADMIN",
  DIRECAO: "DIRECAO",
  RH: "RH",
  COMPRAS: "COMPRAS",
  MANUTENCAO: "MANUTENCAO",
};

function isRole(user, role) {
  return user?.role === role;
}

function hasAnyRole(user, roles = []) {
  return !!user && roles.includes(user.role);
}

module.exports = { ROLES, isRole, hasAnyRole };
