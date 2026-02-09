const express = require("express");
const router = express.Router();

const { requireRole } = require("../auth/auth.middleware");
const ctrl = require("./estoque.controller");

// consultar
router.get("/estoque", requireRole(["almoxarifado","compras","diretoria"]), ctrl.estoqueIndex);
router.get("/estoque/:id", requireRole(["almoxarifado","compras","diretoria"]), ctrl.estoqueShow);

// criar item / movimentar (somente almox/admin)
router.get("/estoque/novo", requireRole(["almoxarifado"]), ctrl.estoqueNewForm);
router.post("/estoque", requireRole(["almoxarifado"]), ctrl.estoqueCreate);
router.post("/estoque/:id/movimento", requireRole(["almoxarifado"]), ctrl.estoqueMovCreate);

module.exports = router;
