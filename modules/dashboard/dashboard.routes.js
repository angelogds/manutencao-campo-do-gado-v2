// modules/dashboard/dashboard.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");

let controller = {};
try {
  controller = require("./dashboard.controller");
  console.log("✅ [dashboard] controller exports:", Object.keys(controller));
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

// ✅ aqui fica padronizado com dashboardIndex
router.get("/dashboard", requireLogin, safe(controller.dashboardIndex, "dashboardIndex"));

module.exports = router;
