// modules/auth/auth.routes.js
const express = require("express");
const router = express.Router();

let controller = {};
try {
  controller = require("./auth.controller");
  console.log("✅ [auth.routes] exports do controller:", Object.keys(controller));
} catch (err) {
  console.error("❌ [auth.routes] erro ao carregar auth.controller:", err.message);
}

function safe(fn, name) {
  if (typeof fn === "function") return fn;
  return (_req, res) => {
    console.error(`❌ [auth.routes] Handler ${name} indefinido.`);
    return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
  };
}

router.get("/login", safe(controller.showLogin, "showLogin"));
router.post("/login", safe(controller.doLogin, "doLogin"));
router.post("/logout", safe(controller.logout, "logout"));

module.exports = router;
