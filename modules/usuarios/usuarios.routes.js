// modules/usuarios/usuarios.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");

// controller (carrega seguro)
let ctrl = {};
try {
  ctrl = require("./usuarios.controller");
  console.log("✅ [usuarios] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [usuarios] Falha ao carregar usuarios.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        try {
          res.locals.activeMenu = "usuarios";
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [usuarios] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// Perfis que podem gerenciar usuários (aceita maiúsculo/minúsculo)
const USERS_ACCESS = ["ADMIN", "DIRETORIA", "RH", "admin", "diretoria", "rh"];

// =====================================================
// ✅ ROTAS DUPLAS (funciona com e sem prefixo no server)
// Se server.js monta com prefixo:
//   app.use("/usuarios", router) -> use "/" "/novo" etc
// Se server.js NÃO monta com prefixo:
//   app.use(router) -> use "/usuarios" "/usuarios/novo" etc
// =====================================================

// LISTAR
router.get("/", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.list, "list"));
router.get("/usuarios", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.list, "list"));

// NOVO
router.get("/novo", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.newForm, "newForm"));
router.get("/usuarios/novo", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.newForm, "newForm"));

// CRIAR
router.post("/", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.create, "create"));
router.post("/usuarios", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.create, "create"));

// EDITAR FORM
router.get("/:id/editar", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.editForm, "editForm"));
router.get("/usuarios/:id/editar", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.editForm, "editForm"));

// ATUALIZAR
router.post("/:id", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.update, "update"));
router.post("/usuarios/:id", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.update, "update"));

// RESET SENHA
router.post("/:id/reset-senha", requireLogin, requireRole(USERS_ACCESS), safe(ctrl.resetPassword, "resetPassword"));
router.post(
  "/usuarios/:id/reset-senha",
  requireLogin,
  requireRole(USERS_ACCESS),
  safe(ctrl.resetPassword, "resetPassword")
);

module.exports = router;
