vconst express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");
const ctrl = require("./dashboard.controller");

router.get("/dashboard", requireLogin, ctrl.dashboardIndex);

module.exports = router;
