const express = require('express');
const router = express.Router();
const ctrl = require('./desenho-tecnico.controller');
const { requireLogin, requireRole } = require('../auth/auth.middleware');
const { ACCESS } = require('../../config/rbac');

const VIEW_ACCESS = ACCESS.desenho_tecnico_view || ['ADMIN'];
const MANAGE_ACCESS = ACCESS.desenho_tecnico_manage || ['ADMIN'];

const withMenu = (handler) => (req, res, next) => {
  res.locals.activeMenu = 'desenho-tecnico';
  return handler(req, res, next);
};

router.get('/', requireLogin, requireRole(VIEW_ACCESS), withMenu(ctrl.index));
router.get('/dashboard', requireLogin, requireRole(VIEW_ACCESS), withMenu(ctrl.dashboard));
router.get('/novo', requireLogin, requireRole(MANAGE_ACCESS), withMenu(ctrl.novo));
router.post('/', requireLogin, requireRole(MANAGE_ACCESS), withMenu(ctrl.create));
router.get('/biblioteca', requireLogin, requireRole(VIEW_ACCESS), withMenu(ctrl.biblioteca));

router.get('/:id', requireLogin, requireRole(VIEW_ACCESS), withMenu(ctrl.show));
router.get('/:id/editar', requireLogin, requireRole(MANAGE_ACCESS), withMenu(ctrl.edit));
router.post('/:id', requireLogin, requireRole(MANAGE_ACCESS), withMenu(ctrl.update));
router.post('/:id/inativar', requireLogin, requireRole(MANAGE_ACCESS), withMenu(ctrl.remove));
router.post('/:id/duplicar', requireLogin, requireRole(MANAGE_ACCESS), withMenu(ctrl.duplicar));
router.post('/:id/pdf', requireLogin, requireRole(MANAGE_ACCESS), withMenu(ctrl.gerarPdf));
router.get('/:id/svg', requireLogin, requireRole(VIEW_ACCESS), withMenu(ctrl.gerarSvg));
router.post('/:id/vincular', requireLogin, requireRole(MANAGE_ACCESS), withMenu(ctrl.vincularEquipamento));
router.get('/:id/revisoes', requireLogin, requireRole(VIEW_ACCESS), withMenu(ctrl.revisoes));

module.exports = router;
