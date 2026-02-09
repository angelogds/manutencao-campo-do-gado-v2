// modules/estoque/estoque.routes.js
const express = require("express");
const router = express.Router();

// middleware login (blindado)
let requireLogin = null;
try {
  const authMw = require("../auth/auth.middleware");
  requireLogin = authMw.requireLogin;
} catch (e) {
  console.error("❌ [estoque] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireLogin =
  typeof requireLogin === "function"
    ? requireLogin
    : (_req, res) => res.status(500).send("Erro interno: requireLogin indefinido.");

// controller (blindado)
let ctrl = {};
try {
  ctrl = require("./estoque.controller");
  console.log("✅ [estoque] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [estoque] Falha ao carregar estoque.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [estoque] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Rotas
router.get("/estoque", safeRequireLogin, safe(ctrl.estoqueIndex, "estoqueIndex"));
router.get("/estoque/novo", safeRequireLogin, safe(ctrl.estoqueNewForm, "estoqueNewForm"));
router.post("/estoque", safeRequireLogin, safe(ctrl.estoqueCreate, "estoqueCreate"));
router.get("/estoque/:id", safeRequireLogin, safe(ctrl.estoqueShow, "estoqueShow"));
router.post("/estoque/:id/movimento", safeRequireLogin, safe(ctrl.estoqueMovCreate, "estoqueMovCreate"));

module.exports = router;
