// modules/preventivas/preventivas.routes.js
const express = require("express");
const router = express.Router();

// middleware (RBAC)
let requireRole = null;
let requireLogin = null;

try {
  const mw = require("../auth/auth.middleware");
  requireRole = mw.requireRole;
  requireLogin = mw.requireLogin;
} catch (e) {
  console.error("❌ [preventivas] Falha ao carregar auth.middleware:", e.message);
}

const safeRequire =
  typeof requireRole === "function"
    ? (roles) => requireRole(roles)
    : typeof requireLogin === "function"
    ? () => requireLogin
    : () => (_req, res) => res.status(500).send("Erro interno: middleware auth indefinido.");

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

// ✅ Ajuste aqui os perfis que podem acessar Preventivas
const PREVENTIVAS_ACCESS = ["MANUTENCAO", "ENCARREGADO", "DIRETORIA"]; // ADMIN passa automático

// ===== PLANOS =====
router.get("/preventivas", safeRequire(PREVENTIVAS_ACCESS), safe(ctrl.planosIndex, "planosIndex"));
router.get("/preventivas/planos/new", safeRequire(PREVENTIVAS_ACCESS), safe(ctrl.planosNewForm, "planosNewForm"));
router.post("/preventivas/planos", safeRequire(PREVENTIVAS_ACCESS), safe(ctrl.planosCreate, "planosCreate"));
router.get("/preventivas/planos/:id", safeRequire(PREVENTIVAS_ACCESS), safe(ctrl.planosShow, "planosShow"));
router.post("/preventivas/planos/:id/toggle", safeRequire(PREVENTIVAS_ACCESS), safe(ctrl.planosToggleAtivo, "planosToggleAtivo"));

// ===== EXECUÇÕES =====
router.post(
  "/preventivas/planos/:id/execucoes",
  safeRequire(PREVENTIVAS_ACCESS),
  safe(ctrl.execucoesCreate, "execucoesCreate")
);

router.post(
  "/preventivas/execucoes/:execId/status",
  safeRequire(PREVENTIVAS_ACCESS),
  safe(ctrl.execucoesUpdateStatus, "execucoesUpdateStatus")
);

module.exports = router;
