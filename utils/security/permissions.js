const ROLES = {
  ADMIN: ['*'],
  DIRECAO: ['dashboard', 'leitura'],
  RH: ['os_nr', 'cronograma'],
  COMPRAS: ['compras', 'estoque'],
  MANUTENCAO: ['os', 'solicitacoes']
};

function hasPermission(role, permission) {
  const perms = ROLES[role] || [];
  return perms.includes('*') || perms.includes(permission);
}

module.exports = { hasPermission, ROLES };
