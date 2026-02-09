const express = require("express");
const router = express.Router();
const { requireLogin } = require("../auth/auth.middleware");
const controller = require("./dashboard.controller");

router.get("/dashboard", requireLogin, controller.index);

module.exports = router;
