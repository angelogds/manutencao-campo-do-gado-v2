const express = require("express");
const { showLogin, handleLogin, handleLogout } = require("./auth.controller");

const router = express.Router();

router.get("/login", showLogin);
router.post("/login", handleLogin);
router.get("/logout", handleLogout);

module.exports = router;
