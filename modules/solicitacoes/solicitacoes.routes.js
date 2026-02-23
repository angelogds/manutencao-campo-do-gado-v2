const express = require("express");
const router = express.Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ACCESS } = require("../../config/rbac");
const ctrl = require("./solicitacoes.controller");

const SOLICITACOES_ACCESS = ACCESS.solicitacoes;

router.get("/", requireLogin, requireRole(SOLICITACOES_ACCESS), ctrl.index);
router.get("/nova", requireLogin, requireRole(SOLICITACOES_ACCESS), ctrl.newForm);
router.post("/", requireLogin, requireRole(SOLICITACOES_ACCESS), ctrl.create);
router.get("/:id", requireLogin, requireRole(SOLICITACOES_ACCESS), ctrl.show);
router.post("/:id/status", requireLogin, requireRole(SOLICITACOES_ACCESS), ctrl.updateStatus);
router.post("/:id/cotacoes", requireLogin, requireRole(SOLICITACOES_ACCESS), ctrl.addCotacao);

module.exports = router;
