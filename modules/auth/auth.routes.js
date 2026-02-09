const express = require("express");
const router = express.Router();

const { showLogin, doLogin, doLogout } = require("./auth.controller");

router.get("/login", showLogin);
router.post("/login", doLogin);
router.get("/logout", doLogout);

module.exports = router;
