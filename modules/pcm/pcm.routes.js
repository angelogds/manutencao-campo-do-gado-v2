const express = require("express");
const router = express.Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const ctrl = require("./pcm.controller");

const PCM_ACCESS = ["ADMIN"];

router.get("/", requireLogin, requireRole(PCM_ACCESS), ctrl.index);
router.get("/planejamento", requireLogin, requireRole(PCM_ACCESS), ctrl.planejamento);
router.get("/falhas", requireLogin, requireRole(PCM_ACCESS), ctrl.falhas);
router.get("/engenharia", requireLogin, requireRole(PCM_ACCESS), ctrl.engenharia);
router.get("/criticidade", requireLogin, requireRole(PCM_ACCESS), ctrl.criticidade);
router.post("/criticidade", requireLogin, requireRole(PCM_ACCESS), ctrl.salvarCriticidade);
router.get("/lubrificacao", requireLogin, requireRole(PCM_ACCESS), ctrl.lubrificacao);
router.get("/pecas-criticas", requireLogin, requireRole(PCM_ACCESS), ctrl.pecasCriticas);
router.get("/programacao-semanal", requireLogin, requireRole(PCM_ACCESS), ctrl.programacaoSemanal);
router.get("/backlog", requireLogin, requireRole(PCM_ACCESS), ctrl.backlog);
router.get("/rotas-inspecao", requireLogin, requireRole(PCM_ACCESS), ctrl.rotasInspecao);
router.get("/relatorios-avancados", requireLogin, requireRole(PCM_ACCESS), ctrl.relatoriosAvancados);

router.post("/planos", requireLogin, requireRole(PCM_ACCESS), ctrl.createPlano);
router.post("/planos/:id/gerar-os", requireLogin, requireRole(PCM_ACCESS), ctrl.gerarOS);
router.post("/planos/:id/registrar-execucao", requireLogin, requireRole(PCM_ACCESS), ctrl.registrarExecucao);

module.exports = router;
