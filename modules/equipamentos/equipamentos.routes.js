const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");
const controller = require("./equipamentos.controller");

router.get("/equipamentos", requireLogin, controller.index);
router.get("/equipamentos/new", requireLogin, controller.newForm);
router.post("/equipamentos", requireLogin, controller.create);

module.exports = router;
