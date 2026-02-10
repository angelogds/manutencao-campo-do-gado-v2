// modules/escala/escala.controller.js
const service = require("./escala.service");

function index(req, res) {
  const ref = (req.query.data || "").toString().trim(); // YYYY-MM-DD opcional
  const baseDate = service.parseDateOrToday(ref);

  const hoje = service.getByDate(baseDate);
  const proximos = service.listRange(baseDate, 7);

  return res.render("escala/index", {
    title: "Escala",
    activeMenu: "escala",
    baseDate,
    hoje,
    proximos,
  });
}

function newForm(req, res) {
  return res.render("escala/nova", {
    title: "Lançar Escala",
    activeMenu: "escala",
    today: service.todayISO(),
  });
}

function create(req, res) {
  const data = (req.body.data || "").toString().trim();
  const turno = (req.body.turno || "").toString().trim().toLowerCase(); // dia|noite
  const categoria = (req.body.categoria || "").toString().trim().toLowerCase(); // mecanico|apoio
  const nome = (req.body.nome || "").toString().trim();
  const observacao = (req.body.observacao || "").toString().trim();

  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    req.flash("error", "Informe a data no formato YYYY-MM-DD.");
    return res.redirect("/escala/nova");
  }

  if (!["dia", "noite"].includes(turno)) {
    req.flash("error", "Turno inválido. Use: dia ou noite.");
    return res.redirect("/escala/nova");
  }

  if (!["mecanico", "apoio"].includes(categoria)) {
    req.flash("error", "Categoria inválida. Use: mecanico ou apoio.");
    return res.redirect("/escala/nova");
  }

  if (!nome) {
    req.flash("error", "Informe o nome do colaborador.");
    return res.redirect("/escala/nova");
  }

  try {
    service.create({
      data,
      turno,
      categoria,
      nome,
      observacao,
    });

    req.flash("success", "Escala lançada com sucesso.");
    return res.redirect(`/escala?data=${data}`);
  } catch (e) {
    req.flash("error", `Erro ao lançar escala: ${e.message}`);
    return res.redirect("/escala/nova");
  }
}

module.exports = { index, newForm, create };
