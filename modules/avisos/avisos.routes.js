const express = require("express");
const router = express.Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const ctrl = require("./avisos.controller");

router.get("/", requireLogin, ctrl.index);
router.post("/", requireLogin, requireRole(["ADMIN", "RH", "ENCARREGADO_PRODUCAO", "DIRECAO", "DIRETORIA"]), ctrl.create);

module.exports = router;
