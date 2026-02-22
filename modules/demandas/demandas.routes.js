const express = require('express');
const router = express.Router();
const { requireLogin, requireRole } = require('../auth/auth.middleware');
const ctrl = require('./demandas.controller');

router.get('/', requireLogin, requireRole(['ADMIN', 'DIRECAO', 'DIRETORIA']), ctrl.index);
router.get('/new', requireLogin, requireRole(['DIRECAO', 'DIRETORIA']), ctrl.newForm);
router.post('/', requireLogin, requireRole(['DIRECAO', 'DIRETORIA']), ctrl.create);
router.get('/:id', requireLogin, requireRole(['ADMIN', 'DIRECAO', 'DIRETORIA']), ctrl.show);
router.post('/:id/status', requireLogin, requireRole(['ADMIN']), ctrl.updateStatus);
router.post('/:id/update', requireLogin, requireRole(['ADMIN']), ctrl.addUpdate);
router.post('/:id/convert-to-os', requireLogin, requireRole(['ADMIN']), ctrl.convertToOS);

module.exports = router;
