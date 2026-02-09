// modules/dashboard/dashboard.routes.js
const express = require("express");
const router = express.Router();

// --- middleware requireLogin (blindado)
let requireLogin = null;
try {
  const authMw = require("../auth/auth.middleware");
  requireLogin = authMw.requireLogin;
} catch (e) {
  console.error("❌ Falha ao carregar auth.middleware:", e.message);
}

// --- controller (blindado)
let dashboardIndex = null;
try {
  const ctrl = require("./dashboard.controller");
  dashboardIndex = ctrl.dashboardIndex;
  console.log("✅ dashboard.controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ Falha ao carregar dashboard.controller:", e.message);
}

// --- fallback: NUNCA deixe undefined chegar no router.get
const safeRequireLogin =
  typeof requireLogin === "function"
    ? requireLogin
    : (req, res, next) => {
        console.error("❌ requireLogin está indefinido (auth.middleware export errado).");
        return res.status(500).send("Erro interno: requireLogin indefinido.");
      };

const safeDashboardIndex =
  typeof dashboardIndex === "function"
    ? dashboardIndex
    : (req, res) => {
        console.error("❌ dashboardIndex está indefinido (dashboard.controller export errado).");
        return res.status(500).send("Erro interno: dashboardIndex indefinido.");
      };

// Rota dashboard
router.get("/dashboard", safeRequireLogin, safeDashboardIndex);

module.exports = router;
