const express = require("express");
const { requireLogin } = require("../auth/auth.middleware");
const ctrl = require("./ai.controller");

const router = express.Router();

router.post("/ask", requireLogin, (req, res) => ctrl.askAI(req, res));

module.exports = router;
