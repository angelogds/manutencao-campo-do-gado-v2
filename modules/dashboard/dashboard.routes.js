// modules/dashboard/dashboard.routes.js
const express = require('express');
const router = express.Router();

const { requireLogin } = require('../auth/auth.middleware');
const ctrl = require('./dashboard.controller');

// padrão igual aos outros módulos (auth/compras/estoque/etc)
// + já marca o menu ativo do dashboard
const safe = (fn, name) =>
  typeof fn === 'function'
    ? (req, res, next) => {
        res.locals.activeMenu = 'dashboard';
        try {
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [dashboard] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

router.get('/', requireLogin, safe(ctrl.index, 'index'));
router.post('/avisos', requireLogin, safe(ctrl.createAviso, 'createAviso'));

router.get('/alertas/stream', requireLogin, safe(ctrl.sse, 'sse'));
router.post('/alertas/reconhecer', requireLogin, safe(ctrl.reconhecerAlerta, 'reconhecerAlerta'));
router.post('/push/subscribe', requireLogin, safe(ctrl.subscribePush, 'subscribePush'));

module.exports = router;
