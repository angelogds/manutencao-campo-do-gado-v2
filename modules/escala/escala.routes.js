const express = require("express");
const router = express.Router();

const controller = require("./escala.controller");
const { requireLogin } = require("../auth/auth.middleware");

// Página principal (semana atual ou por data)
router.get("/escala", requireLogin, controller.index);

// Ver escala completa (opcional)
router.get("/escala/completa", requireLogin, controller.completa);

// Adicionar rápido (opcional)
router.post("/escala/adicionar", requireLogin, controller.adicionarRapido);

// Lançar folga/atestado por período
router.post("/escala/ausencia", requireLogin, controller.lancarAusencia);

// Editar semana (trocar turno)
router.get("/escala/editar/:id", requireLogin, controller.editarSemana);
router.post("/escala/editar/:id", requireLogin, controller.salvarEdicao);

// PDF (semana)
router.get("/escala/pdf/semana/:id", requireLogin, controller.pdfSemana);

// PDF (período start/end)
router.get("/escala/pdf", requireLogin, controller.pdfPeriodo);

module.exports = router;
