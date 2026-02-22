// modules/os/os.routes.js
const express = require('express');
const router = express.Router();

const { requireLogin, requireRole } = require('../auth/auth.middleware');

// Perfis que podem abrir/acessar OS (ADMIN passa sempre no middleware)
const OS_ACCESS = ["MANUTENCAO", "MECANICO", "PRODUCAO", "ENCARREGADO"];

function loadController() {
  try {
    // Recarrega o módulo para evitar estado inconsistente quando houve falha prévia de carga.
    const ctrlPath = require.resolve('./os.controller');
    delete require.cache[ctrlPath];
    const controller = require('./os.controller');
    return controller;
  } catch (e) {
    console.error('❌ [os] Falha ao carregar os.controller:', e.message);
    return null;
  }
}

function safe(name) {
  return (req, res, next) => {
    res.locals.activeMenu = 'os';
    const ctrl = loadController();
    const fn = ctrl?.[name];

    if (typeof fn !== 'function') {
      console.error(`❌ [os] Handler ${name} indefinido.`);
      return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
    }

    try {
      return fn(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
}

router.get("/", requireLogin, requireRole(OS_ACCESS), safe("osIndex"));
router.get("/nova", requireLogin, requireRole(OS_ACCESS), safe("osNewForm"));
router.post("/", requireLogin, requireRole(OS_ACCESS), safe("osCreate"));
router.get("/:id", requireLogin, requireRole(OS_ACCESS), safe("osShow"));
router.post("/:id/status", requireLogin, requireRole(OS_ACCESS), safe("osUpdateStatus"));
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
