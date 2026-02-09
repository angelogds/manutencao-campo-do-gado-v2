// modules/equipamentos/equipamentos.routes.js
const express = require("express");
const router = express.Router();

// middleware login (blindado)
let requireLogin = null;
try {
  const authMw = require("../auth/auth.middleware");
  requireLogin = authMw.requireLogin;
} catch (e) {
  console.error("❌ [equipamentos] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireLogin =
  typeof requireLogin === "function"
    ? requireLogin
    : (_req, res) => res.status(500).send("Erro interno: requireLogin indefinido.");

// controller (blindado)
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

// Rotas
router.get("/equipamentos", safeRequireLogin, safe(ctrl.equipIndex, "equipIndex"));
router.get("/equipamentos/novo", safeRequireLogin, safe(ctrl.equipNewForm, "equipNewForm"));
router.post("/equipamentos", safeRequireLogin, safe(ctrl.equipCreate, "equipCreate"));
router.get("/equipamentos/:id", safeRequireLogin, safe(ctrl.equipShow, "equipShow"));
router.get("/equipamentos/:id/editar", safeRequireLogin, safe(ctrl.equipEditForm, "equipEditForm"));
router.post("/equipamentos/:id", safeRequireLogin, safe(ctrl.equipUpdate, "equipUpdate"));

module.exports = router;
