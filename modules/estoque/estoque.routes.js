const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");
const controller = require("./escala.controller");

let ctrl = {};
try {
  ctrl = controller;
  console.log("✅ [escala] controller exports:", Object.keys(ctrl));
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

// 🔥 IMPORTANTE: COLOCAR /escala NO CAMINHO
router.get(
  "/escala",
  requireLogin,
  safe(ctrl.index, "index")
);

router.get(
  "/escala/completa",
  requireLogin,
  safe(ctrl.completa, "completa")
);

router.get(
  "/escala/editar/:id",
  requireLogin,
  safe(ctrl.editarSemana, "editarSemana")
);

router.post(
  "/escala/editar/:id",
  requireLogin,
  safe(ctrl.salvarEdicao, "salvarEdicao")
);

router.get(
  "/escala/pdf/:id",
  requireLogin,
  safe(ctrl.gerarPdf, "gerarPdf")
);

module.exports = router;
