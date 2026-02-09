const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ROLES } = require("../../utils/security/permissions");

router.get(
  "/compras",
  requireLogin,
  requireRole([ROLES.ADMIN, ROLES.COMPRAS]),
  (req, res) => res.render("compras/index", { title: "Compras" })
);

module.exports = router;
