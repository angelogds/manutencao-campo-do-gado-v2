const express = require("express");
const router = express.Router();

const { requireRole } = require("../auth/auth.middleware");
const ctrl = require("./compras.controller");

// tudo compras restrito
router.get("/compras", requireRole(["compras","diretoria"]), ctrl.comprasIndex);
router.get("/compras/nova", requireRole(["compras","diretoria"]), ctrl.comprasNewForm);
router.post("/compras", requireRole(["compras","diretoria"]), ctrl.comprasCreate);
router.get("/compras/:id", requireRole(["compras","diretoria"]), ctrl.comprasShow);

module.exports = router;
