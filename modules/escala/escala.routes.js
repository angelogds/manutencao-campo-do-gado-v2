// modules/escala/escala.routes.js
const express = require("express");
const router = express.Router();

// middleware (RBAC) - blindado
let requireLogin = null;
let requireRole = null;

try {
  const mw = require("../auth/auth.middleware");
  requireLogin = mw.requireLogin;
  requireRole = mw.requireRole;
} catch (e) {
  console.error("❌ [escala] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireLogin =
  typeof requireLogin === "function"
    ? requireLogin
    : (_req, res, _next) => res.status(500).send("Erro interno: requireLogin indefinido.");

const safeRequireRole =
  typeof requireRole === "function"
    ? requireRole
    : () => (_req, res) => res.status(500).send("Erro interno: requireRole indefinido.");

// controller - blindado
let ctrl = {};
try {
  ctrl = require("./escala.controller");
  console.log("✅ [escala] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [escala] Falha ao carregar escala.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [escala] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Acesso para VISUALIZAR escala (quase todos os perfis)
const ESCALA_VIEW = ["compras", "producao", "almoxarifado", "mecanico", "rh", "diretoria"]; // admin passa automático

// Acesso para EDITAR/CRIAR escala
const ESCALA_EDIT = ["rh"]; // admin passa automático

router.get("/escala", safeRequireLogin, safeRequireRole(ESCALA_VIEW), safe(ctrl.index, "index"));
router.get("/escala/nova", safeRequireLogin, safeRequireRole(ESCALA_EDIT), safe(ctrl.newForm, "newForm"));
router.post("/escala", safeRequireLogin, safeRequireRole(ESCALA_EDIT), safe(ctrl.create, "create"));

module.exports = router;
