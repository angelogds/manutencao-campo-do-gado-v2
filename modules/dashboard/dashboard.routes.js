const express = require("express");
const router = express.Router();

const ctrl = require("./dashboard.controller");
const { requireAuth } = require("../auth/auth.middleware");

// Dashboard (página)
router.get("/dashboard", requireAuth, ctrl.index);

// (Opcional) página inicial redireciona
router.get("/home", requireAuth, (_req, res) => res.redirect("/dashboard"));

module.exports = router;
