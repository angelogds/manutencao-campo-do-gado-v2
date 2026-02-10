// modules/compras/compras.routes.js
const express = require("express");
const router = express.Router();

const ctrl = require("./compras.controller");

// middleware
const { requireLogin, requireRole } = require("../auth/auth.middleware");

// Permissões Compras (admin passa automaticamente)
const COMPRAS_ACCESS = ["compras", "diretoria"];

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [compras] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// ===== SOLICITAÇÕES (Inbox) =====
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

// ===== COMPRAS (recebimento) =====
router.get(
  "/compras",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasIndex, "comprasIndex")
);

router.get(
  "/compras/nova",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasNewForm, "comprasNewForm")
);

router.post(
  "/compras",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasCreate, "comprasCreate")
);

router.get(
  "/compras/:id",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasShow, "comprasShow")
);

router.post(
  "/compras/:id/status",
  requireLogin,
  requireRole(COMPRAS_ACCESS),
  safe(ctrl.comprasUpdateStatus, "comprasUpdateStatus")
);

module.exports = router;
