// modules/os/os.routes.js
const express = require("express");
const router = express.Router();

// middleware login (blindado)
let requireLogin = null;
try {
  const authMw = require("../auth/auth.middleware");
  requireLogin = authMw.requireLogin;
} catch (e) {
  console.error("❌ [os] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireLogin =
  typeof requireLogin === "function"
    ? requireLogin
    : (_req, res) => res.status(500).send("Erro interno: requireLogin indefinido.");

// controller (blindado)
let ctrl = {};
try {
  ctrl = require("./os.controller");
  console.log("✅ [os] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [os] Falha ao carregar os.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [os] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

router.get("/os", safeRequireLogin, safe(ctrl.osIndex, "osIndex"));
router.get("/os/nova", safeRequireLogin, safe(ctrl.osNewForm, "osNewForm"));
router.post("/os", safeRequireLogin, safe(ctrl.osCreate, "osCreate"));
router.get("/os/:id", safeRequireLogin, safe(ctrl.osShow, "osShow"));
router.post("/os/:id/status", safeRequireLogin, safe(ctrl.osUpdateStatus, "osUpdateStatus"));

module.exports = router;
