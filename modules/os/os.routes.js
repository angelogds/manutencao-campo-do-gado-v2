// modules/os/os.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");
const ctrl = require("./os.controller");

// Perfis que podem abrir/acessar OS (ADMIN passa sempre no middleware)
const OS_ACCESS = ["MANUTENCAO", "MECANICO", "PRODUCAO", "ENCARREGADO"];

// wrapper padrão para evitar quebra geral e manter menu ativo
const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        res.locals.activeMenu = "os";
        try {
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [os] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// ✅ ROTAS (prefixo /os já é aplicado no server.js)
router.get("/", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osIndex, "osIndex"));
router.get("/nova", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osNewForm, "osNewForm"));
router.post("/", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osCreate, "osCreate"));
router.get("/:id", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osShow, "osShow"));
router.post("/:id/status", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osUpdateStatus, "osUpdateStatus"));

module.exports = router;
