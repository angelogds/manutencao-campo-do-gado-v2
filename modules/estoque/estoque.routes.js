// modules/estoque/estoque.routes.js
const express = require("express");
const router = express.Router();

// middleware (RBAC)
let requireRole = null;
try {
  requireRole = require("../auth/auth.middleware").requireRole;
} catch (e) {
  console.error("❌ [estoque] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireRole =
  typeof requireRole === "function"
    ? requireRole
    : () => (_req, res) => res.status(500).send("Erro interno: requireRole indefinido.");

// controller
let ctrl = {};
try {
  ctrl = require("./estoque.controller");
  console.log("✅ [estoque] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [estoque] Falha ao carregar estoque.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [estoque] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Permissões Estoque
const ESTOQUE_VIEW = ["almoxarifado", "compras", "diretoria"]; // admin passa automaticamente
const ESTOQUE_EDIT = ["almoxarifado"]; // admin passa automaticamente

// listar/consultar
router.get("/estoque", safeRequireRole(ESTOQUE_VIEW), safe(ctrl.estoqueIndex, "estoqueIndex"));
router.get("/estoque/:id", safeRequireRole(ESTOQUE_VIEW), safe(ctrl.estoqueShow, "estoqueShow"));

// cadastrar item / movimentar (somente almox/admin)
router.get("/estoque/novo", safeRequireRole(ESTOQUE_EDIT), safe(ctrl.estoqueNewForm, "estoqueNewForm"));
router.post("/estoque", safeRequireRole(ESTOQUE_EDIT), safe(ctrl.estoqueCreate, "estoqueCreate"));
router.post(
  "/estoque/:id/movimento",
  safeRequireRole(ESTOQUE_EDIT),
  safe(ctrl.estoqueMovCreate, "estoqueMovCreate")
);

module.exports = router;
