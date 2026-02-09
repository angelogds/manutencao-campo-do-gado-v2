// modules/equipamentos/equipamentos.routes.js
const express = require("express");
const router = express.Router();

// middleware (RBAC)
let requireRole = null;
try {
  requireRole = require("../auth/auth.middleware").requireRole;
} catch (e) {
  console.error("❌ [equipamentos] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireRole =
  typeof requireRole === "function"
    ? requireRole
    : () => (_req, res) => res.status(500).send("Erro interno: requireRole indefinido.");

// controller
let ctrl = {};
try {
  ctrl = require("./equipamentos.controller");
  console.log("✅ [equipamentos] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [equipamentos] Falha ao carregar equipamentos.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [equipamentos] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Permissões Equipamentos
const EQ_VIEW = ["manutencao", "rh", "diretoria"]; // admin passa automaticamente
const EQ_EDIT = ["manutencao"]; // admin passa automaticamente

router.get("/equipamentos", safeRequireRole(EQ_VIEW), safe(ctrl.equipIndex, "equipIndex"));
router.get("/equipamentos/novo", safeRequireRole(EQ_EDIT), safe(ctrl.equipNewForm, "equipNewForm"));
router.post("/equipamentos", safeRequireRole(EQ_EDIT), safe(ctrl.equipCreate, "equipCreate"));
router.get("/equipamentos/:id", safeRequireRole(EQ_VIEW), safe(ctrl.equipShow, "equipShow"));
router.get("/equipamentos/:id/editar", safeRequireRole(EQ_EDIT), safe(ctrl.equipEditForm, "equipEditForm"));
router.post("/equipamentos/:id", safeRequireRole(EQ_EDIT), safe(ctrl.equipUpdate, "equipUpdate"));

module.exports = router;
