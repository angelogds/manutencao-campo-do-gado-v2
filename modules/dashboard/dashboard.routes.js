// modules/dashboard/dashboard.routes.js
const express = require("express");
const router = express.Router();

const { requireLogin } = require("../auth/auth.middleware");

let ctrl = {};
try {
  ctrl = require("./dashboard.controller");
  console.log("✅ [dashboard] controller exports:", Object.keys(ctrl));
} catch (e) {
  console.error("❌ [dashboard] Falha ao carregar dashboard.controller:", e.message);
}

const safe = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        try {
          res.locals.activeMenu = "dashboard";
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [dashboard] Handler ${name} indefinido (export errado).`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

// ✅ GET /dashboard
router.get("/", requireLogin, safe(ctrl.index, "index"));

module.exports = router;
