const service = require("./escala.service");
const { buildEscalaPdf } = require("../../utils/pdf/pdfEscala");

function index(req, res) {
  const date = (req.query.date || "").trim(); // YYYY-MM-DD opcional
  const range = date ? service.getWeekRangeFromDate(date) : service.getCurrentWeekRange();
  const semana = service.ensureSemana(range.monday, range.sunday);

  const alocacoes = service.listAlocacoesSemana(semana.id);
  const colaboradores = service.listColaboradoresAtivos();

  return res.render("escala/index", {
    layout: "layout",
    title: "Escala",
    activeMenu: "escala",
    semana,
    range,
    alocacoes,
    colaboradores,
  });
}

function create(req, res) {
  const { semana_id, tipo_turno, horario_inicio, horario_fim, colaborador_id, observacao } = req.body;

  if (!semana_id || !colaborador_id || !tipo_turno) {
    req.flash("error", "Informe semana, colaborador e tipo de turno.");
    return res.redirect("/escala");
  }

  service.createAlocacao({
    semana_id,
    tipo_turno,
    horario_inicio,
    horario_fim,
    colaborador_id,
    observacao,
  });

  req.flash("success", "Alocação adicionada na escala.");
  return res.redirect("/escala");
}

function pdfSemana(req, res) {
  const date = (req.query.date || "").trim();
  const range = date ? service.getWeekRangeFromDate(date) : service.getCurrentWeekRange();
  const semana = service.ensureSemana(range.monday, range.sunday);
  const alocacoes = service.listAlocacoesSemana(semana.id);

  const filename = `escala_${range.monday}_a_${range.sunday}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

  // gera PDF
  buildEscalaPdf(res, { range, alocacoes });
}

module.exports = { index, create, pdfSemana };
