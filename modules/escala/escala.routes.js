// modules/escala/escala.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ACCESS } = require("../../config/rbac");

// controller (carrega seguro)
let controller = {};
try {
  controller = require("./escala.controller");
  console.log("✅ [escala] controller exports:", Object.keys(controller));
} catch (e) {
  console.error("❌ [escala] Falha ao carregar escala.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        try {
          res.locals.activeMenu = "escala";
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [escala] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// =====================================================
// ✅ ROTAS (prefixo já é /escala no server.js)
// Então aqui é: /, /completa, /editar/:id...
// =====================================================

// Página principal (semana atual ou por data)
// GET /escala
router.get("/", requireLogin, requireRole(ACCESS.escala), safe(controller.index, "index"));

// Ver escala completa (opcional)
// GET /escala/completa
router.get("/completa", requireLogin, requireRole(ACCESS.escala), safe(controller.completa, "completa"));

// Adicionar rápido (opcional)
// POST /escala/adicionar
router.post("/adicionar", requireLogin, requireRole(ACCESS.escala), safe(controller.adicionarRapido, "adicionarRapido"));

// Lançar folga/atestado por período
// POST /escala/ausencia
router.post("/ausencia", requireLogin, requireRole(ACCESS.escala), safe(controller.lancarAusencia, "lancarAusencia"));

// Editar semana (trocar turno)
// GET /escala/editar/:id
router.get("/editar/:id", requireLogin, requireRole(ACCESS.escala), safe(controller.editarSemana, "editarSemana"));
// POST /escala/editar/:id
router.post("/editar/:id", requireLogin, requireRole(ACCESS.escala), safe(controller.salvarEdicao, "salvarEdicao"));

// PDF (semana)
// GET /escala/pdf/semana/:id
router.get("/pdf/semana/:id", requireLogin, requireRole(ACCESS.escala), safe(controller.pdfSemana, "pdfSemana"));

// PDF por período (start/end)
// GET /escala/pdf/periodo?start=2026-01-10&end=2026-02-15
router.get("/pdf/periodo", requireLogin, requireRole(ACCESS.escala), safe(controller.pdfPeriodo, "pdfPeriodo"));

// Compatibilidade com rota anterior
router.get("/pdf", requireLogin, requireRole(ACCESS.escala), safe(controller.pdfPeriodo, "pdfPeriodo"));

module.exports = router;
