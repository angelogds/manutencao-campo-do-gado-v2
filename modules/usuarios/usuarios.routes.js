const express = require("express");
const router = express.Router();

const { requireRole } = require("../auth/auth.middleware");
const ctrl = require("./usuarios.controller");

router.get("/usuarios", requireRole(["admin"]), ctrl.userIndex);
router.get("/usuarios/novo", requireRole(["admin"]), ctrl.userNewForm);
router.post("/usuarios", requireRole(["admin"]), ctrl.userCreate);

module.exports = router;
