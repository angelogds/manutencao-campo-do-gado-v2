const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");

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
        console.error(`❌ [escala] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

router.get("/escala", requireLogin, safe(ctrl.index, "index"));

module.exports = router;
