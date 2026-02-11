const express = require("express");
const router = express.Router();

// RBAC
let requireRole = null;
try {
  requireRole = require("../auth/auth.middleware").requireRole;
} catch (e) {
  console.error("❌ [preventivas] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireRole =
  typeof requireRole === "function"
    ? requireRole
    : () => (_req, res) => res.status(500).send("Erro interno: requireRole indefinido.");

// controller
let ctrl = {};
try {
  ctrl = require("./preventivas.controller");
  console.log("✅ [preventivas] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [preventivas] Falha ao carregar preventivas.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [preventivas] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Quem pode ver preventivas
const PREV_ACCESS = ["ADMIN", "MECANICO", "PRODUCAO", "DIRETORIA", "RH"];

// Rotas
router.get("/preventivas", safeRequireRole(PREV_ACCESS), safe(ctrl.index, "index"));
router.get("/preventivas/nova", safeRequireRole(["ADMIN", "MECANICO"]), safe(ctrl.newForm, "newForm"));
router.post("/preventivas", safeRequireRole(["ADMIN", "MECANICO"]), safe(ctrl.create, "create"));

router.get("/preventivas/:id", safeRequireRole(PREV_ACCESS), safe(ctrl.show, "show"));

// Execuções do plano
router.post("/preventivas/:id/execucoes", safeRequireRole(["ADMIN", "MECANICO"]), safe(ctrl.execCreate, "execCreate"));
router.post("/preventivas/:id/execucoes/:execId/status", safeRequireRole(["ADMIN", "MECANICO"]), safe(ctrl.execUpdateStatus, "execUpdateStatus"));

module.exports = router;
