
// modules/escala/escala.routes.js
const express = require("express");
const router = express.Router();

let controller = {};
try {
  controller = require("./escala.controller");
  console.log("✅ [escala] controller exports:", Object.keys(controller));
} catch (e) {
  console.error("❌ [escala] Falha ao carregar escala.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [escala] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// ✅ páginas
router.get("/escala", safe(controller.index, "index"));

// ✅ criar item (opcional: você pode usar depois no form)
router.post("/escala", safe(controller.create, "create"));

// ✅ PDF da semana (você já tinha — mantive)
router.get("/escala/pdf/semana", safe(controller.pdfSemana, "pdfSemana"));

module.exports = router;
