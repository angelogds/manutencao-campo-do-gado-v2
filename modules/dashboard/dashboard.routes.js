const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");

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

router.get("/dashboard", requireLogin, safe(ctrl.index, "index"));

module.exports = router;
