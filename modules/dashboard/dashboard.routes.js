// modules/dashboard/dashboard.routes.js
const express = require("express");
const router = express.Router();

// middleware
let requireLogin = null;
try {
  requireLogin = require("../auth/auth.middleware").requireLogin;
} catch (e) {
  console.error("❌ [dashboard] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireLogin =
  typeof requireLogin === "function"
    ? requireLogin
    : (_req, res) => res.status(500).send("Erro interno: requireLogin indefinido.");

// controller
let ctrl = {};
try {
  ctrl = require("./dashboard.controller");
  console.log("✅ [dashboard] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [dashboard] Falha ao carregar dashboard.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [dashboard] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// rota
router.get("/dashboard", safeRequireLogin, safe(ctrl.dashboardIndex, "dashboardIndex"));

module.exports = router;
