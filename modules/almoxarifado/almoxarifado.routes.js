const express = require("express");
const router = express.Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ACCESS } = require("../../config/rbac");
const ctrl = require("./almoxarifado.controller");

const ALMOX_ACCESS = ACCESS.almoxarifado;

router.get("/", requireLogin, requireRole(ALMOX_ACCESS), ctrl.index);
router.post("/funcionarios", requireLogin, requireRole(ALMOX_ACCESS), ctrl.createFuncionario);
router.post("/retiradas", requireLogin, requireRole(ALMOX_ACCESS), ctrl.createRetirada);

module.exports = router;
