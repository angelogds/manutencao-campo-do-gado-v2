// modules/equipamentos/equipamentos.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");

let ctrl = {};
try {
  ctrl = require("./equipamentos.controller");
  console.log("✅ [equipamentos] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [equipamentos] Falha ao carregar equipamentos.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        try {
          res.locals.activeMenu = "equipamentos";
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => res.status(500).send(`Erro interno: handler ${name} indefinido.`);

// ✅ /equipamentos
router.get("/", requireLogin, safe(ctrl.equipIndex, "equipIndex"));

// ✅ /equipamentos/novo
router.get("/novo", requireLogin, safe(ctrl.equipNewForm, "equipNewForm"));
router.post("/", requireLogin, safe(ctrl.equipCreate, "equipCreate"));

// ✅ /equipamentos/:id
router.get("/:id", requireLogin, safe(ctrl.equipShow, "equipShow"));

// ✅ /equipamentos/:id/editar
router.get("/:id/editar", requireLogin, safe(ctrl.equipEditForm, "equipEditForm"));
router.post("/:id/editar", requireLogin, safe(ctrl.equipUpdate, "equipUpdate"));

module.exports = router;
