const express = require("express");
const router = express.Router();

let requireRole;
try {
  requireRole = require("../auth/auth.middleware").requireRole;
} catch {
  requireRole = () => (_req, res) =>
    res.status(500).send("Erro interno: auth.middleware ausente");
}

const ctrl = require("./escala.controller");

// perfis que podem ver escala
const ESCALA_ACCESS = ["admin", "producao", "mecanico", "almoxarifado"];

const safe = (fn, name) =>
  typeof fn === "function"
    ? fn
    : (_req, res) =>
        res.status(500).send(`Handler ${name} indefinido`);

router.get(
  "/escala",
  requireRole(ESCALA_ACCESS),
  safe(ctrl.index, "index")
);

module.exports = router;
