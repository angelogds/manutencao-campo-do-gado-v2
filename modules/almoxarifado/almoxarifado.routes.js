const router = require("express").Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ACCESS } = require("../../config/rbac");
const ctrl = require("./almoxarifado.controller");

router.get("/", requireLogin, requireRole(ACCESS.almoxarifado), ctrl.index);
router.post("/retiradas", requireLogin, requireRole(ACCESS.almoxarifado), ctrl.createRetirada);

router.get("/recebimentos", requireLogin, requireRole(ACCESS.almoxarifado), ctrl.recebimentosIndex);
router.post("/solicitacoes/:id/iniciar-recebimento", requireLogin, requireRole(ACCESS.almoxarifado), ctrl.iniciarRecebimento);
router.get("/solicitacoes/:id/conferir", requireLogin, requireRole(ACCESS.almoxarifado), ctrl.conferir);
router.post("/solicitacoes/:id/itens/:itemId/receber", requireLogin, requireRole(ACCESS.almoxarifado), ctrl.receberItem);
router.post("/solicitacoes/:id/finalizar-recebimento", requireLogin, requireRole(ACCESS.almoxarifado), ctrl.finalizar);
router.post("/solicitacoes/:id/fechar", requireLogin, requireRole(ACCESS.almoxarifado), ctrl.fechar);
router.post("/solicitacoes/:id/reabrir", requireLogin, requireRole(ACCESS.almoxarifado), ctrl.reabrir);

module.exports = router;
