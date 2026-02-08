const express = require("express");
const router = express.Router();
const ctrl = require("./escala.controller");

// Períodos
router.get("/periodos", ctrl.listPeriodos);
router.get("/periodos/novo", ctrl.formNovoPeriodo);
router.post("/periodos", ctrl.createPeriodo);

// Gerar semanas + alocações automáticas (Regra A)
router.post("/periodos/:id/gerar", ctrl.gerarEscalaAutomatica);

// Visualização
router.get("/periodos/:id", ctrl.viewPeriodo);
router.get("/periodos/:id/semana/:semanaNumero", ctrl.viewSemana);

// Edição (admin)
router.get("/alocacoes/:id/editar", ctrl.formEditarAlocacao);
router.post("/alocacoes/:id", ctrl.updateAlocacao);

// Produção: quem está disponível AGORA
router.get("/agora", ctrl.viewAgora);

// PDFs
router.get("/periodos/:id/pdf-mural", ctrl.pdfMural);
router.get("/periodos/:id/pdf-rh", ctrl.pdfRH);

module.exports = router;
