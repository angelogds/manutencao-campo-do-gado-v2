const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");

let ctrl = {};
try {
  ctrl = require("./preventivas.controller");
  console.log("✅ [preventivas] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [preventivas] Falha ao carregar preventivas.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [preventivas] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

router.get("/preventivas", requireLogin, safe(ctrl.index, "index"));
router.get("/preventivas/nova", requireLogin, safe(ctrl.newForm, "newForm"));
router.post("/preventivas", requireLogin, safe(ctrl.create, "create"));
router.get("/preventivas/:id", requireLogin, safe(ctrl.show, "show"));

module.exports = router;
