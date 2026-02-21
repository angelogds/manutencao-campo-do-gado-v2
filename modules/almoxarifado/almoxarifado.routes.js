const express = require("express");
const router = express.Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const ctrl = require("./almoxarifado.controller");

const ACCESS = ["ADMIN", "almoxarife", "compras"];

router.get("/", requireLogin, requireRole(ACCESS), ctrl.index);
router.post("/funcionarios", requireLogin, requireRole(ACCESS), ctrl.createFuncionario);
router.post("/retiradas", requireLogin, requireRole(ACCESS), ctrl.createRetirada);

module.exports = router;
