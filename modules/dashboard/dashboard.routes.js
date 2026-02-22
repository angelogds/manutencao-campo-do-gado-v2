// modules/dashboard/dashboard.routes.js
const express = require('express');
const router = express.Router();

const { requireLogin } = require('../auth/auth.middleware');
const ctrl = require('./dashboard.controller');

function wrapRoute(handler, name) {
  return (req, res, next) => {
    res.locals.activeMenu = 'dashboard';

    if (typeof handler !== 'function') {
      console.error(`❌ [dashboard] Handler ${name} indefinido.`);
      return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
    }

    try {
      return handler(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
}

router.get('/', requireLogin, wrapRoute(ctrl.index, 'index'));
router.post('/avisos', requireLogin, wrapRoute(ctrl.createAviso, 'createAviso'));
router.get('/alertas/stream', requireLogin, wrapRoute(ctrl.sse, 'sse'));
router.post('/alertas/reconhecer', requireLogin, wrapRoute(ctrl.reconhecerAlerta, 'reconhecerAlerta'));
router.post('/push/subscribe', requireLogin, wrapRoute(ctrl.subscribePush, 'subscribePush'));

module.exports = router;
