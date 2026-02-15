const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

const COMPRAS_ACCESS = ["compras", "diretoria", "ADMIN"];

let ctrl = {};
try {
  ctrl = require("./compras.controller");
  console.log("✅ [compras] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [compras] Falha ao carregar compras.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [compras] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// =============================
// LISTA PRINCIPAL DE COMPRAS
// URL FINAL: /compras
// =============================
router.get(
  "/",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasIndex, "comprasIndex")
);

// =============================
// SOLICITAÇÕES
// URL FINAL: /compras/solicitacoes
// =============================
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
