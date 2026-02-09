const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");
const controller = require("./os.controller");

// prefixo /os
router.use("/os", requireLogin);

router.get("/os", controller.list);
router.get("/os/new", controller.newForm);
router.post("/os", controller.create);
router.get("/os/:id", controller.view);

module.exports = router;
