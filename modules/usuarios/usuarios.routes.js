// modules/usuarios/usuarios.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

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

// Perfis que podem gerenciar usuários
const USERS_ACCESS = ["admin", "diretoria", "rh"];

// Base
router.get("/usuarios", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.list, "list"));
router.get("/usuarios/novo", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.newForm, "newForm"));
router.post("/usuarios", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.create, "create"));

router.get("/usuarios/:id/editar", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.editForm, "editForm"));
router.post("/usuarios/:id", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.update, "update"));

router.post("/usuarios/:id/reset-senha", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.resetPassword, "resetPassword"));

module.exports = router;
