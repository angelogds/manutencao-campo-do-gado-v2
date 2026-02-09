// modules/dashboard/dashboard.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");

// pega a função diretamente
const { index } = require("./dashboard.controller");

// se por algum motivo vier undefined, lança erro claro
if (typeof index !== "function") {
  throw new Error("dashboard.controller.index não foi exportado corretamente.");
}

router.get("/dashboard", requireLogin, index);

module.exports = router;
