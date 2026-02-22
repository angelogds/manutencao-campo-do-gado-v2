const express = require("express");
const router = express.Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const ctrl = require("./solicitacoes.controller");

const ACCESS = ["ADMIN", "compras", "almoxarife", "diretoria", "encarregado_producao"];

router.get("/", requireLogin, requireRole(ACCESS), ctrl.index);
router.get("/nova", requireLogin, requireRole(ACCESS), ctrl.newForm);
router.post("/", requireLogin, requireRole(ACCESS), ctrl.create);
router.get("/:id", requireLogin, requireRole(ACCESS), ctrl.show);
router.post("/:id/status", requireLogin, requireRole(ACCESS), ctrl.updateStatus);
router.post("/:id/cotacoes", requireLogin, requireRole(ACCESS), ctrl.addCotacao);

module.exports = router;
