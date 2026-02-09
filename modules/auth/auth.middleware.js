const { hasPermission } = require('../../utils/security/permissions');

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(permission) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    if (!hasPermission(req.session.user.role, permission)) {
      return res.status(403).send('Acesso negado');
    }

    next();
  };
}

module.exports = { requireLogin, requireRole };
