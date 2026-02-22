const express = require("express");
const router = express.Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const ctrl = require("./avisos.controller");

const publishRoles = ["ADMIN", "RH", "ENCARREGADO_PRODUCAO", "DIRECAO", "DIRETORIA"];

router.get("/", requireLogin, ctrl.index);
router.post("/", requireLogin, requireRole(publishRoles), ctrl.create);
router.post("/:id/delete", requireLogin, requireRole(publishRoles), ctrl.remove);

module.exports = router;
