// modules/compras/compras.routes.js
const express = require("express");
const router = express.Router();

// middleware login (blindado)
let requireLogin = null;
try {
  const authMw = require("../auth/auth.middleware");
  requireLogin = authMw.requireLogin;
} catch (e) {
  console.error("❌ [compras] Falha ao carregar auth.middleware:", e.message);
}

// controller (blindado)
let comprasIndex = null;
let comprasNewForm = null;
let comprasCreate = null;
let comprasShow = null;

try {
  const ctrl = require("./compras.controller");
  console.log("✅ [compras] controller exports:", Object.keys(ctrl));
  comprasIndex = ctrl.comprasIndex;
  comprasNewForm = ctrl.comprasNewForm;
  comprasCreate = ctrl.comprasCreate;
  comprasShow = ctrl.comprasShow;
} catch (e) {
  console.error("❌ [compras] Falha ao carregar compras.controller:", e.message);
}

const safeRequireLogin =
  typeof requireLogin === "function"
    ? requireLogin
    : (_req, res) => res.status(500).send("Erro interno: requireLogin indefinido.");

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [compras] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Rotas
router.get("/compras", safeRequireLogin, safe(comprasIndex, "comprasIndex"));
router.get("/compras/nova", safeRequireLogin, safe(comprasNewForm, "comprasNewForm"));
router.post("/compras", safeRequireLogin, safe(comprasCreate, "comprasCreate"));
router.get("/compras/:id", safeRequireLogin, safe(comprasShow, "comprasShow"));

module.exports = router;
