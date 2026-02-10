// modules/estoque/estoque.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

// Permissões Estoque:
// - almoxarifado: controla entradas/saídas
// - mecânico: consulta e dá baixa (se você quiser)
// - diretoria: consulta
// - admin: tudo
const ESTOQUE_ACCESS = ["almoxarifado", "mecanico", "diretoria"]; // adicione "producao" se quiser só consulta

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

router.get("/estoque", requireLogin, requireRole(ESTOQUE_ACCESS), safe(ctrl.estoqueIndex, "estoqueIndex"));

router.get("/estoque/novo", requireLogin, requireRole(["almoxarifado", "diretoria"]), safe(ctrl.estoqueNewForm, "estoqueNewForm"));
router.post("/estoque", requireLogin, requireRole(["almoxarifado", "diretoria"]), safe(ctrl.estoqueCreate, "estoqueCreate"));

router.get("/estoque/:id", requireLogin, requireRole(ESTOQUE_ACCESS), safe(ctrl.estoqueShow, "estoqueShow"));

// Movimentação (entrada/saída/ajuste) — normalmente só almoxarifado (e admin)
router.post(
  "/estoque/:id/mov",
  requireLogin,
  requireRole(["almoxarifado", "diretoria"]),
  safe(ctrl.estoqueMovCreate, "estoqueMovCreate")
);

module.exports = router;
