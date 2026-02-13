const express = require("express");
const router = express.Router();

const controller = require("./escala.controller");
const { requireLogin } = require("../auth/auth.middleware");

// Página principal - mostra apenas semana atual
router.get("/", requireLogin, controller.index);

// Escala completa (ano inteiro)
router.get("/completa", requireLogin, controller.completa);

// Editar semana
router.get("/editar/:id", requireLogin, controller.editarSemana);
router.post("/editar/:id", requireLogin, controller.salvarEdicao);

// Gerar PDF da semana
router.get("/pdf/:id", requireLogin, controller.gerarPdf);

module.exports = router;
