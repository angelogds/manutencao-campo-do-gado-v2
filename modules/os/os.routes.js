// modules/os/os.routes.js
const express = require('express');
const router = express.Router();

const { requireLogin, requireRole } = require('../auth/auth.middleware');
const ctrl = require('./os.controller');

// Perfis que podem abrir/acessar OS (ADMIN passa sempre no middleware)
const OS_ACCESS = ['MANUTENCAO', 'MECANICO', 'PRODUCAO', 'ENCARREGADO'];

function wrapHandler(handler, name) {
  return (req, res, next) => {
    res.locals.activeMenu = 'os';
    if (typeof handler !== 'function') {
      console.error(`❌ [os] Handler ${name} indefinido.`);
      return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
    }

    try {
      return handler(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
}

router.get('/', requireLogin, requireRole(OS_ACCESS), wrapHandler(ctrl.osIndex, 'osIndex'));
router.get('/nova', requireLogin, requireRole(OS_ACCESS), wrapHandler(ctrl.osNewForm, 'osNewForm'));
router.post('/', requireLogin, requireRole(OS_ACCESS), wrapHandler(ctrl.osCreate, 'osCreate'));
router.get('/:id', requireLogin, requireRole(OS_ACCESS), wrapHandler(ctrl.osShow, 'osShow'));
router.post('/:id/status', requireLogin, requireRole(OS_ACCESS), wrapHandler(ctrl.osUpdateStatus, 'osUpdateStatus'));

module.exports = router;
