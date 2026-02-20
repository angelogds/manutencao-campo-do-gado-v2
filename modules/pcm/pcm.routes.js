const express = require("express");
const router = express.Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const ctrl = require("./pcm.controller");

const PCM_ACCESS = ["ADMIN"];

router.get("/", requireLogin, requireRole(PCM_ACCESS), ctrl.index);
router.post("/planos", requireLogin, requireRole(PCM_ACCESS), ctrl.createPlano);
router.post("/planos/:id/gerar-os", requireLogin, requireRole(PCM_ACCESS), ctrl.gerarOS);
router.post("/planos/:id/registrar-execucao", requireLogin, requireRole(PCM_ACCESS), ctrl.registrarExecucao);

module.exports = router;
