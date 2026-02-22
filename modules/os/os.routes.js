// modules/os/os.routes.js
const express = require('express');
const router = express.Router();

const { requireLogin, requireRole } = require('../auth/auth.middleware');

// Perfis que podem abrir/acessar OS (ADMIN passa sempre no middleware)
const OS_ACCESS = ['MANUTENCAO', 'MECANICO', 'PRODUCAO', 'ENCARREGADO'];

function tryLoadController(forceReload = false) {
  try {
    const ctrlPath = require.resolve('./os.controller');
    if (forceReload) delete require.cache[ctrlPath];
    return require('./os.controller');
  } catch (e) {
    console.error('❌ [os] Falha ao carregar os.controller:', e.message);
    return null;
  }
}

function withControllerHandler(handlerName) {
  return (req, res, next) => {
    res.locals.activeMenu = 'os';

    let controller = tryLoadController(false);
    let handler = controller?.[handlerName];

    if (typeof handler !== 'function') {
      controller = tryLoadController(true);
      handler = controller?.[handlerName];
    }

    if (typeof handler !== 'function') {
      console.error(`❌ [os] Handler ${handlerName} indefinido.`);
      return res.status(500).send(`Erro interno: handler ${handlerName} indefinido.`);
    }

    try {
      return handler(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
}

router.get('/', requireLogin, requireRole(OS_ACCESS), withControllerHandler('osIndex'));
router.get('/nova', requireLogin, requireRole(OS_ACCESS), withControllerHandler('osNewForm'));
router.post('/', requireLogin, requireRole(OS_ACCESS), withControllerHandler('osCreate'));
router.get('/:id', requireLogin, requireRole(OS_ACCESS), withControllerHandler('osShow'));
router.post('/:id/status', requireLogin, requireRole(OS_ACCESS), withControllerHandler('osUpdateStatus'));

module.exports = router;
