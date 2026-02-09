const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");
const controller = require("./usuarios.controller");

// tudo em /admin/users (ADMIN)
router.use("/admin/users", requireLogin, requireRole(["ADMIN"]));

router.get("/admin/users", controller.list);
router.get("/admin/users/new", controller.newForm);
router.post("/admin/users", controller.create);

router.get("/admin/users/:id/edit", controller.editForm);
router.post("/admin/users/:id", controller.update);

router.post("/admin/users/:id/reset-password", controller.resetPassword);

module.exports = router;
