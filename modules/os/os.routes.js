const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");
const controller = require("./os.controller");

// prefixo /os
router.get("/os", requireLogin, controller.list);
router.get("/os/new", requireLogin, controller.newForm);
router.post("/os", requireLogin, controller.create);
router.get("/os/:id", requireLogin, controller.view);

module.exports = router;
