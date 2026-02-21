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

router.get("/", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasIndex, "comprasIndex"));
router.get("/nova", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasNewForm, "comprasNewForm"));
router.post("/", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasCreate, "comprasCreate"));
router.get("/:id", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasShow, "comprasShow"));
router.post("/:id/status", requireLogin, requireRole(COMPRAS_ACCESS), safe(ctrl.comprasUpdateStatus, "comprasUpdateStatus"));

// Compatibilidade com caminho antigo de solicitações
router.get("/solicitacoes", (_req, res) => res.redirect("/solicitacoes"));
router.get("/solicitacoes/nova", (_req, res) => res.redirect("/solicitacoes/nova"));
router.get("/solicitacoes/:id", (req, res) => res.redirect(`/solicitacoes/${req.params.id}`));

module.exports = router;
