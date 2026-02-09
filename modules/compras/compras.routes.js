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

const safeRequireLogin =
  typeof requireLogin === "function"
    ? requireLogin
    : (_req, res) => res.status(500).send("Erro interno: requireLogin indefinido.");

// controller (blindado)
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

/**
 * SOLICITAÇÕES
 */
router.get("/solicitacoes", safeRequireLogin, safe(ctrl.solicitacoesIndex, "solicitacoesIndex"));
router.get("/solicitacoes/nova", safeRequireLogin, safe(ctrl.solicitacoesNewForm, "solicitacoesNewForm"));
router.post("/solicitacoes", safeRequireLogin, safe(ctrl.solicitacoesCreate, "solicitacoesCreate"));
router.get("/solicitacoes/:id", safeRequireLogin, safe(ctrl.solicitacoesShow, "solicitacoesShow"));
router.post("/solicitacoes/:id/status", safeRequireLogin, safe(ctrl.solicitacoesUpdateStatus, "solicitacoesUpdateStatus"));

/**
 * COMPRAS (recebimento)
 */
router.get("/compras", safeRequireLogin, safe(ctrl.comprasIndex, "comprasIndex"));
router.get("/compras/nova", safeRequireLogin, safe(ctrl.comprasNewForm, "comprasNewForm"));
router.post("/compras", safeRequireLogin, safe(ctrl.comprasCreate, "comprasCreate"));
router.get("/compras/:id", safeRequireLogin, safe(ctrl.comprasShow, "comprasShow"));
router.post("/compras/:id/status", safeRequireLogin, safe(ctrl.comprasUpdateStatus, "comprasUpdateStatus"));

module.exports = router;
