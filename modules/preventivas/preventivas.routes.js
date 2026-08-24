// modules/preventivas/preventivas.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ACCESS } = require("../../config/rbac");

let ctrl = {};
try {
  ctrl = require("./preventivas.controller");
  console.log("✅ [preventivas] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [preventivas] Falha ao carregar preventivas.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        try {
          res.locals.activeMenu = "preventivas";
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [preventivas] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

const PREV_ACCESS = ACCESS.preventivas_view;

router.get(
  "/",
  requireLogin,
  requireRole(PREV_ACCESS),
  safe(ctrl.index, "index")
);

router.get(
  "/nova",
  requireLogin,
  requireRole(ACCESS.preventivas_manage),
  safe(ctrl.newForm, "newForm")
);

router.post(
  "/",
  requireLogin,
  requireRole(ACCESS.preventivas_manage),
  safe(ctrl.create, "create")
);

// Tela exibida no menu como "Eleger Mecânico".
// Mantemos aliases para compatibilidade com versões já implantadas.
router.get(
  ["/eleger-mecanico", "/responsaveis", "/equipe"],
  requireLogin,
  requireRole(ACCESS.preventivas_manage),
  safe(ctrl.responsaveisForm, "responsaveisForm")
);

router.post(
  ["/eleger-mecanico", "/responsaveis", "/equipe"],
  requireLogin,
  requireRole(ACCESS.preventivas_manage),
  safe(ctrl.responsaveisSave, "responsaveisSave")
);

router.get(
  "/:id",
  requireLogin,
  requireRole(PREV_ACCESS),
  safe(ctrl.show, "show")
);

router.post(
  "/:id/execucoes",
  requireLogin,
  requireRole(ACCESS.preventivas_manage),
  safe(ctrl.execCreate, "execCreate")
);

router.post(
  "/:id/execucoes/:execId/status",
  requireLogin,
  requireRole(ACCESS.preventivas_manage),
  safe(ctrl.execUpdateStatus, "execUpdateStatus")
);

module.exports = router;
