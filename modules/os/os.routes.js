// modules/os/os.routes.js
const express = require("express");
const router = express.Router();

const ctrl = require("./os.controller");
const { requireLogin, requireRole } = require("../auth/auth.middleware");

const OS_ACCESS = ["PRODUCAO", "MANUTENCAO", "MECANICO", "DIRECAO"]; // ADMIN passa sempre

router.get("/os", requireLogin, requireRole(OS_ACCESS), ctrl.osIndex);
router.get("/os/nova", requireLogin, requireRole(OS_ACCESS), ctrl.osNewForm);
router.post("/os", requireLogin, requireRole(OS_ACCESS), ctrl.osCreate);

router.get("/os/:id", requireLogin, requireRole(OS_ACCESS), ctrl.osShow);
router.post("/os/:id/status", requireLogin, requireRole(OS_ACCESS), ctrl.osUpdateStatus);

module.exports = router;
