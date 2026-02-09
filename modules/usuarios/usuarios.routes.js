const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ROLES } = require("../../utils/security/permissions");

router.get(
  "/admin/users",
  requireLogin,
  requireRole([ROLES.ADMIN]),
  (req, res) => res.render("admin/users", { title: "Usuários" })
);

module.exports = router;
