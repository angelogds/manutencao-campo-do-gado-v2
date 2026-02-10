// modules/os/os.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

// Permissões OS: produção abre, mecânico acompanha, encarregado acompanha
// admin passa automaticamente (pelo seu middleware)
const OS_ACCESS = ["producao", "mecanico", "encarregado", "diretoria"];

let ctrl = {};
try {
  ctrl = require("./os.controller");
  console.log("✅ [os] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [os] Falha ao carregar os.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) => {
        console.error(`❌ [os] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

router.get("/os", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osIndex, "osIndex"));
router.get("/os/nova", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osNewForm, "osNewForm"));
router.post("/os", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osCreate, "osCreate"));
router.get("/os/:id", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osShow, "osShow"));
router.post("/os/:id/status", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osUpdateStatus, "osUpdateStatus"));

module.exports = router;
