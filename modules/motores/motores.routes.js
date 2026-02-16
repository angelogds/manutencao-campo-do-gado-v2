const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

let ctrl = {};
try {
  ctrl = require("./motores.controller");
  console.log("✅ [motores] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [motores] Falha ao carregar motores.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        try {
          res.locals.activeMenu = "motores";
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [motores] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

const ACCESS = ["ALMOXARIFE", "ADMIN"];

router.get("/", requireLogin, requireRole(ACCESS), safe(ctrl.index, "index"));
router.get("/new", requireLogin, requireRole(ACCESS), safe(ctrl.newForm, "newForm"));
router.post("/", requireLogin, requireRole(ACCESS), safe(ctrl.create, "create"));

router.get("/:id", requireLogin, requireRole(ACCESS), safe(ctrl.show, "show"));

router.post("/:id/enviar", requireLogin, requireRole(ACCESS), safe(ctrl.enviar, "enviar"));
router.post("/:id/retorno", requireLogin, requireRole(ACCESS), safe(ctrl.retorno, "retorno"));

module.exports = router;
