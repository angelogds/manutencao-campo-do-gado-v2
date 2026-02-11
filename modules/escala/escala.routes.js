const express = require("express");
const router = express.Router();

let requireRole = null;
try {
  requireRole = require("../auth/auth.middleware").requireRole;
} catch (e) {
  console.error("❌ [escala] Falha ao carregar auth.middleware:", e.message);
}

const safeRequireRole =
  typeof requireRole === "function"
    ? requireRole
    : () => (_req, res) => res.status(500).send("Erro interno: requireRole indefinido.");

let ctrl = {};
try {
  ctrl = require("./escala.controller");
  console.log("✅ [escala] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [escala] Falha ao carregar escala.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [escala] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Quem pode ver escala
const ESCALA_ACCESS = ["ADMIN", "MECANICO", "PRODUCAO", "ALMOXARIFADO", "COMPRAS", "DIRETORIA", "RH"];

router.get("/escala", safeRequireRole(ESCALA_ACCESS), safe(ctrl.index, "index"));
router.post("/escala", safeRequireRole(["ADMIN"]), safe(ctrl.create, "create")); // só admin edita por enquanto
router.get("/escala/pdf", safeRequireRole(ESCALA_ACCESS), safe(ctrl.pdfSemana, "pdfSemana"));

module.exports = router;
