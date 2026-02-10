// modules/equipamentos/equipamentos.routes.js
const express = require("express");
const router = express.Router();

// ===== activeMenu no layout =====
router.use((req, res, next) => {
  res.locals.activeMenu = "equipamentos";
  next();
});

// ===== RBAC =====
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

// ✅ Quem pode acessar Equipamentos?
// admin sempre passa (seu requireRole já trata isso), aqui liberamos mecânico e produção também.
const EQUIP_ACCESS = ["mecanico", "producao", "encarregado", "compras", "almoxarifado", "rh", "diretoria"];

router.get("/equipamentos", safeRequireRole(EQUIP_ACCESS), safe(ctrl.equipIndex, "equipIndex"));
router.get("/equipamentos/novo", safeRequireRole(EQUIP_ACCESS), safe(ctrl.equipNewForm, "equipNewForm"));
router.post("/equipamentos", safeRequireRole(EQUIP_ACCESS), safe(ctrl.equipCreate, "equipCreate"));
router.get("/equipamentos/:id", safeRequireRole(EQUIP_ACCESS), safe(ctrl.equipShow, "equipShow"));
router.get("/equipamentos/:id/editar", safeRequireRole(EQUIP_ACCESS), safe(ctrl.equipEditForm, "equipEditForm"));
router.post("/equipamentos/:id", safeRequireRole(EQUIP_ACCESS), safe(ctrl.equipUpdate, "equipUpdate"));

module.exports = router;
