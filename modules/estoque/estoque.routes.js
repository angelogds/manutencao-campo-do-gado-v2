// modules/estoque/estoque.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

// Permissões Estoque:
// - ALMOXARIFADO: controla entradas/saídas
// - MECANICO: consulta (se quiser)
// - DIRETORIA: consulta
// - ADMIN: tudo (admin passa automaticamente no requireRole, se seu middleware faz isso)
const ESTOQUE_ACCESS = ["ALMOXARIFADO", "MECANICO", "DIRETORIA", "almoxarifado", "mecanico", "diretoria"];

let ctrl = {};
try {
  ctrl = require("./estoque.controller");
  console.log("✅ [estoque] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [estoque] Falha ao carregar estoque.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        try {
          res.locals.activeMenu = "estoque";
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [estoque] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// =====================================================
// ✅ IMPORTANTE:
// Este arquivo assume que no server.js você faz:
// app.use("/estoque", require("./modules/estoque/estoque.routes"))
// Então aqui dentro NÃO pode repetir "/estoque".
// =====================================================

// INDEX -> GET /estoque
router.get("/", requireLogin, requireRole(ESTOQUE_ACCESS), safe(ctrl.estoqueIndex, "estoqueIndex"));

// FORM NOVO -> GET /estoque/novo
router.get(
  "/novo",
  requireLogin,
  requireRole(["ALMOXARIFADO", "DIRETORIA", "almoxarifado", "diretoria"]),
  safe(ctrl.estoqueNewForm, "estoqueNewForm")
);

// CREATE -> POST /estoque
router.post(
  "/",
  requireLogin,
  requireRole(["ALMOXARIFADO", "DIRETORIA", "almoxarifado", "diretoria"]),
  safe(ctrl.estoqueCreate, "estoqueCreate")
);

// SHOW -> GET /estoque/:id
router.get("/:id", requireLogin, requireRole(ESTOQUE_ACCESS), safe(ctrl.estoqueShow, "estoqueShow"));

// MOV -> POST /estoque/:id/mov
router.post(
  "/:id/mov",
  requireLogin,
  requireRole(["ALMOXARIFADO", "DIRETORIA", "almoxarifado", "diretoria"]),
  safe(ctrl.estoqueMovCreate, "estoqueMovCreate")
);

module.exports = router;
