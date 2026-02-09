const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");
const controller = require("./usuarios.controller");

// tudo em /admin/users
router.get("/admin/users", requireLogin, requireRole(["ADMIN"]), controller.list);
router.get("/admin/users/new", requireLogin, requireRole(["ADMIN"]), controller.newForm);
router.post("/admin/users", requireLogin, requireRole(["ADMIN"]), controller.create);

router.get("/admin/users/:id/edit", requireLogin, requireRole(["ADMIN"]), controller.editForm);
router.post("/admin/users/:id", requireLogin, requireRole(["ADMIN"]), controller.update);

router.post("/admin/users/:id/reset-password", requireLogin, requireRole(["ADMIN"]), controller.resetPassword);

module.exports = router;
