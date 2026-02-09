const express = require("express");
const router = express.Router();

const { requireRole } = require("../auth/auth.middleware");
const ctrl = require("./equipamentos.controller");

router.get("/equipamentos", requireRole(["manutencao","rh","diretoria"]), ctrl.equipIndex);
router.get("/equipamentos/novo", requireRole(["manutencao"]), ctrl.equipNewForm);
router.post("/equipamentos", requireRole(["manutencao"]), ctrl.equipCreate);
router.get("/equipamentos/:id", requireRole(["manutencao","rh","diretoria"]), ctrl.equipShow);
router.get("/equipamentos/:id/editar", requireRole(["manutencao"]), ctrl.equipEditForm);
router.post("/equipamentos/:id", requireRole(["manutencao"]), ctrl.equipUpdate);

module.exports = router;
