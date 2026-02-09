const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");
const ctrl = require("./os.controller");

router.get("/os", requireLogin, ctrl.index);
router.get("/os/nova", requireLogin, ctrl.createForm);
router.post("/os", requireLogin, ctrl.create);

module.exports = router;
