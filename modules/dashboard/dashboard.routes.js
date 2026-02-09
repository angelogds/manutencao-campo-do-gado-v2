// modules/dashboard/dashboard.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");

// IMPORTA A FUNÇÃO DIRETO (evita controller.index undefined)
const { dashboardIndex } = require("./dashboard.controller");

// Se não for função, explode com erro claro (melhor que [object Undefined])
if (typeof dashboardIndex !== "function") {
  throw new Error(
    "dashboard.controller não exportou dashboardIndex. Confira exports em dashboard.controller.js"
  );
}

router.get("/dashboard", requireLogin, dashboardIndex);

module.exports = router;
