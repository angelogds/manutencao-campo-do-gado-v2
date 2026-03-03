const router = require("express").Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ACCESS } = require("../../config/rbac");
const ctrl = require("./compras.controller");

router.get("/solicitacoes", requireLogin, requireRole(ACCESS.compras), ctrl.lista);
router.get("/solicitacoes/:id", requireLogin, requireRole(ACCESS.compras), ctrl.detalhe);
router.post("/solicitacoes/:id/assumir", requireLogin, requireRole(ACCESS.compras), ctrl.assumir);
router.post("/solicitacoes/:id/atualizar-dados", requireLogin, requireRole(ACCESS.compras), ctrl.atualizarDados);
router.post("/solicitacoes/:id/marcar-comprada", requireLogin, requireRole(ACCESS.compras), ctrl.marcarComprada);
router.get("/solicitacoes/:id/pdf", requireLogin, requireRole(ACCESS.compras), ctrl.pdf);
router.get("/", (_req, res) => res.redirect("/compras/solicitacoes"));

module.exports = router;
