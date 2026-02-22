// modules/os/os.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

// Perfis que podem abrir/acessar OS (ADMIN passa sempre no middleware)
const OS_ACCESS = ["MANUTENCAO", "MECANICO", "PRODUCAO", "ENCARREGADO"];

let ctrl = {};
try {
  ctrl = require("./os.controller");
  console.log("✅ [os] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [os] Falha ao carregar os.controller:", e.message);
}

function resolveCtrlFn(name, current) {
  if (typeof current === 'function') return current;
  try {
    const fresh = require('./os.controller');
    if (typeof fresh?.[name] === 'function') return fresh[name];
  } catch (e) {
    console.error(`❌ [os] Reload controller falhou para ${name}:`, e.message);
  }
  return null;
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        try {
          // garante menu ativo no layout
          res.locals.activeMenu = "os";
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (req, res, next) => {
        const recovered = resolveCtrlFn(name, fn);
        if (recovered) {
          try {
            res.locals.activeMenu = 'os';
            return recovered(req, res, next);
          } catch (err) {
            return next(err);
          }
        }
        console.error(`❌ [os] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// ✅ ROTAS CERTAS (prefixo /os já está no server.js)
// GET  /os
router.get("/", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osIndex, "osIndex"));

// GET  /os/nova
router.get("/nova", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osNewForm, "osNewForm"));

// POST /os
router.post("/", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osCreate, "osCreate"));

// GET  /os/:id
router.get("/:id", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osShow, "osShow"));

// POST /os/:id/status
router.post("/:id/status", requireLogin, requireRole(OS_ACCESS), safe(ctrl.osUpdateStatus, "osUpdateStatus"));

module.exports = router;
