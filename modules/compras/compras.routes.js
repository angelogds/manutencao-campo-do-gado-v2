// modules/compras/compras.routes.js
const express = require("express");
const router = express.Router();

// middleware (RBAC)
let requireRole = null;
try {
  requireRole = require("../auth/auth.middleware").requireRole;
} catch (e) {
  console.error("❌ [compras] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireRole =
  typeof requireRole === "function"
    ? requireRole
    : () => (_req, res) => res.status(500).send("Erro interno: requireRole indefinido.");

// controller
let ctrl = {};
try {
  ctrl = require("./compras.controller");
  console.log("✅ [compras] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [compras] Falha ao carregar compras.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [compras] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Permissões Compras
const COMPRAS_ACCESS = ["compras", "diretoria"]; // admin passa automaticamente

router.get("/compras", safeRequireRole(COMPRAS_ACCESS), safe(ctrl.comprasIndex, "comprasIndex"));
router.get("/compras/nova", safeRequireRole(COMPRAS_ACCESS), safe(ctrl.comprasNewForm, "comprasNewForm"));
router.post("/compras", safeRequireRole(COMPRAS_ACCESS), safe(ctrl.comprasCreate, "comprasCreate"));
router.get("/compras/:id", safeRequireRole(COMPRAS_ACCESS), safe(ctrl.comprasShow, "comprasShow"));

module.exports = router;
