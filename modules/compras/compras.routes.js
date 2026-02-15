// modules/compras/compras.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

let ctrl = {};
try {
  ctrl = require("./compras.controller");
  console.log("✅ [compras] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [compras] Falha ao carregar compras.controller:", e.message);
}

const COMPRAS_ACCESS = [
  "ADMIN", "DIRETORIA", "COMPRAS", // padrão novo
  "admin", "diretoria", "compras"  // compatibilidade
];

const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        try {
          res.locals.activeMenu = "compras";
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [compras] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// ======================
// HOME COMPRAS (lista de compras/recebimentos)
// GET /compras
// ======================
router.get(
  "/",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasIndex, "comprasIndex")
);

// GET /compras/nova
router.get(
  "/nova",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasNewForm, "comprasNewForm")
);

// POST /compras
router.post(
  "/",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasCreate, "comprasCreate")
);

// GET /compras/:id
router.get(
  "/:id",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasShow, "comprasShow")
);

// POST /compras/:id/status
router.post(
  "/:id/status",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasUpdateStatus, "comprasUpdateStatus")
);

// ======================
// SOLICITAÇÕES (inbox)
// /compras/solicitacoes...
// ======================
router.get(
  "/solicitacoes",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesIndex, "solicitacoesIndex")
);

router.get(
  "/solicitacoes/nova",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesNewForm, "solicitacoesNewForm")
);

router.post(
  "/solicitacoes",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesCreate, "solicitacoesCreate")
);

router.get(
  "/solicitacoes/:id",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesShow, "solicitacoesShow")
);

router.post(
  "/solicitacoes/:id/status",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesUpdateStatus, "solicitacoesUpdateStatus")
);

module.exports = router;
