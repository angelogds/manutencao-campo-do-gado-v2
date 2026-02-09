const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ROLES } = require("../../utils/security/permissions");

router.get(
  "/os",
  requireLogin,
  requireRole([ROLES.ADMIN, ROLES.MANUTENCAO, ROLES.RH]),
  (req, res) => res.render("os/index", { title: "Ordens de Serviço" })
);

module.exports = router;
