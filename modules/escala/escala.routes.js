const express = require("express");
const router = express.Router();
const controller = require("./escala.controller");
const { requireLogin } = require("../auth/auth.middleware");

router.get("/", requireLogin, controller.index);
router.get("/completa", requireLogin, controller.completa);

router.get("/editar/:id", requireLogin, controller.editarSemana);
router.post("/editar/:id", requireLogin, controller.salvarEdicao);

router.get("/pdf/:id", requireLogin, controller.gerarPdf);

module.exports = router;
