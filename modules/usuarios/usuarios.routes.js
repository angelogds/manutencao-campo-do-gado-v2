// modules/usuarios/usuarios.routes.js
const express = require("express");
const router = express.Router();

// middleware (RBAC)
let requireRole = null;
try {
  requireRole = require("../auth/auth.middleware").requireRole;
} catch (e) {
  console.error("❌ [usuarios] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireRole =
  typeof requireRole === "function"
    ? requireRole
    : () => (_req, res) => res.status(500).send("Erro interno: requireRole indefinido.");

// controller
let ctrl = {};
try {
  ctrl = require("./usuarios.controller");
  console.log("✅ [usuarios] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [usuarios] Falha ao carregar usuarios.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [usuarios] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Permissões Usuários (somente admin; se quiser RH depois, adicione "rh")
const USERS_ADMIN = ["admin"];

router.get("/usuarios", safeRequireRole(USERS_ADMIN), safe(ctrl.userIndex, "userIndex"));
router.get("/usuarios/novo", safeRequireRole(USERS_ADMIN), safe(ctrl.userNewForm, "userNewForm"));
router.post("/usuarios", safeRequireRole(USERS_ADMIN), safe(ctrl.userCreate, "userCreate"));

module.exports = router;
