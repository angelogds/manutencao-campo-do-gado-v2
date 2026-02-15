// modules/compras/compras.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

// =====================================================
// ✅ IMPORTANTE:
// Este arquivo assume que no server.js você faz:
// app.use("/compras", require("./modules/compras/compras.routes"))
// Então aqui dentro NÃO pode repetir "/compras".
// =====================================================

// Permissões Compras (ADMIN passa automaticamente no middleware)
// (coloquei maiúsculo + minúsculo para não dar 403/404 por divergência)
const COMPRAS_ACCESS = ["COMPRAS", "DIRETORIA", "compras", "diretoria", "ADMIN", "admin"];

let ctrl = {};
try {
  ctrl = require("./compras.controller");
  console.log("✅ [compras] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [compras] Falha ao carregar compras.controller:", e.message);
}

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
        console.error(`❌ [compras] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// =====================================================
// ✅ SOLICITAÇÕES (Inbox)  -> /compras/solicitacoes...
// =====================================================

// GET  /compras/solicitacoes
router.get(
  "/solicitacoes",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesIndex, "solicitacoesIndex")
);

// GET  /compras/solicitacoes/nova
router.get(
  "/solicitacoes/nova",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesNewForm, "solicitacoesNewForm")
);

// POST /compras/solicitacoes
router.post(
  "/solicitacoes",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesCreate, "solicitacoesCreate")
);

// GET  /compras/solicitacoes/:id
router.get(
  "/solicitacoes/:id",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesShow, "solicitacoesShow")
);

// POST /compras/solicitacoes/:id/status
router.post(
  "/solicitacoes/:id/status",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.solicitacoesUpdateStatus, "solicitacoesUpdateStatus")
);

// =====================================================
// ✅ COMPRAS (recebimento) -> /compras (lista principal)
// =====================================================

// GET  /compras
router.get("/", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasIndex, "comprasIndex"));

// GET  /compras/nova
router.get("/nova", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasNewForm, "comprasNewForm"));

// POST /compras
router.post("/", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasCreate, "comprasCreate"));

// GET  /compras/:id
router.get("/:id", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasShow, "comprasShow"));

// POST /compras/:id/status
router.post("/:id/status", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasUpdateStatus, "comprasUpdateStatus"));

module.exports = router;
