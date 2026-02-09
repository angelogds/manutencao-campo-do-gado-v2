const express = require("express");
const router = express.Router();

const { requireRole } = require("../auth/auth.middleware");
const ctrl = require("./os.controller");

router.get("/os", requireRole(["manutencao","producao","rh","diretoria"]), ctrl.osIndex);
router.get("/os/nova", requireRole(["manutencao","producao","rh","diretoria"]), ctrl.osNewForm);
router.post("/os", requireRole(["manutencao","producao","rh","diretoria"]), ctrl.osCreate);
router.get("/os/:id", requireRole(["manutencao","producao","rh","diretoria"]), ctrl.osShow);
router.post("/os/:id/status", requireRole(["manutencao","rh","diretoria"]), ctrl.osUpdateStatus);

module.exports = router;
