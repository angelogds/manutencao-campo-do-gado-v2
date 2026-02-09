// modules/os/os.routes.js
const express = require("express");
const router = express.Router();

// middleware (RBAC)
let requireRole = null;
try {
  requireRole = require("../auth/auth.middleware").requireRole;
} catch (e) {
  console.error("❌ [os] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireRole =
  typeof requireRole === "function"
    ? requireRole
    : () => (_req, res) => res.status(500).send("Erro interno: requireRole indefinido.");

// controller
let ctrl = {};
try {
  ctrl = require("./os.controller");
  console.log("✅ [os] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [os] Falha ao carregar os.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [os] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Permissões OS
const OS_ACCESS = ["manutencao", "producao", "rh", "diretoria"]; // admin passa automaticamente
const OS_STATUS = ["manutencao", "rh", "diretoria"]; // produção não altera status (só abre/acompanha)

router.get("/os", safeRequireRole(OS_ACCESS), safe(ctrl.osIndex, "osIndex"));
router.get("/os/nova", safeRequireRole(OS_ACCESS), safe(ctrl.osNewForm, "osNewForm"));
router.post("/os", safeRequireRole(OS_ACCESS), safe(ctrl.osCreate, "osCreate"));
router.get("/os/:id", safeRequireRole(OS_ACCESS), safe(ctrl.osShow, "osShow"));
router.post("/os/:id/status", safeRequireRole(OS_STATUS), safe(ctrl.osUpdateStatus, "osUpdateStatus"));

module.exports = router;
