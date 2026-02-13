// modules/escala/escala.controller.js
const escalaService = require("./escala.service");

exports.index = (req, res) => {
  res.locals.activeMenu = "escala";

  const periodo = escalaService.getPeriodo2026();
  const semanas = periodo ? escalaService.getSemanasComTimes(periodo.id) : [];

  return res.render("escala/index", {
    title: "Escala",
    periodo,
    semanas,
  });
};

exports.importarEscala2026 = (req, res) => {
  res.locals.activeMenu = "escala";
  try {
    const { seedEscala2026 } = require("../../database/seed");
    if (typeof seedEscala2026 !== "function") {
      req.flash("error", "Seed de escala não disponível.");
      return res.redirect("/escala");
    }

    seedEscala2026();
    req.flash("success", "Escala 2026 importada/atualizada com sucesso.");
    return res.redirect("/escala");
  } catch (e) {
    console.error("❌ importarEscala2026:", e);
    req.flash("error", "Erro ao importar escala 2026.");
    return res.redirect("/escala");
  }
};
