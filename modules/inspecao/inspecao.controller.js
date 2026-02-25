const service = require("./inspecao.service");
const { buildCSV, renderPDF } = require("../../utils/exporters/inspecao.exporter");

function parseMesAno(req) {
  const ano = Number(req.params.ano || new Date().getFullYear());
  const mes = Number(req.params.mes || new Date().getMonth() + 1);
  return { ano, mes };
}

function loadPageData(req) {
  const { ano, mes } = parseMesAno(req);
  const inspecao = service.getOrCreateInspecao(mes, ano, req.session?.user);
  service.recalculate(inspecao.id, mes, ano);

  const equipamentos = service.listEquipamentosAtivos();
  const matrix = service.buildMatrix(inspecao.id, ano, mes, equipamentos);
  const ncList = service.listNC(inspecao.id);
  const osDetailsByCell = service.listOSDetailsByInspecao(inspecao.id, mes, ano);

  return {
    ano,
    mes,
    inspecao,
    equipamentos,
    matrix,
    ncList,
    osDetailsByCell,
    diasMes: service.daysInMonth(ano, mes),
    backUrl: req.get("Referrer") || "/dashboard",
  };
}

function index(_req, res) {
  const now = new Date();
  return res.redirect(`/inspecao/${now.getFullYear()}/${now.getMonth() + 1}`);
}

function viewMonth(req, res) {
  const data = loadPageData(req);
  return res.render("inspecao/index", {
    layout: "layout",
    title: "PAC 01 – Manutenção (Inspeção)",
    activeMenu: "inspecao",
    ...data,
  });
}

function recalculate(req, res) {
  const { ano, mes } = parseMesAno(req);
  const inspecao = service.getOrCreateInspecao(mes, ano, req.session?.user);
  service.updateHeader(inspecao.id, req.body || {});
  const result = service.recalculate(inspecao.id, mes, ano);
  req.flash("success", `Inspeção recalculada com ${result.osCount} OS processadas.`);
  return res.redirect(`/inspecao/${ano}/${mes}`);
}

function saveNC(req, res) {
  const { ano, mes } = parseMesAno(req);
  const inspecao = service.getOrCreateInspecao(mes, ano, req.session?.user);
  service.saveNC(inspecao.id, req.body || {});
  req.flash("success", "Não conformidade atualizada.");
  return res.redirect(`/inspecao/${ano}/${mes}`);
}

function saveObservation(req, res) {
  const { ano, mes } = parseMesAno(req);
  const inspecao = service.getOrCreateInspecao(mes, ano, req.session?.user);
  service.updateObservation(inspecao.id, req.body || {});
  req.flash("success", "Observação salva.");
  return res.redirect(`/inspecao/${ano}/${mes}`);
}

function exportPDF(req, res) {
  const data = loadPageData(req);
  return renderPDF({ res, ...data });
}

function exportCSV(req, res) {
  const data = loadPageData(req);
  const csv = buildCSV(data);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=inspecao-pac01-${data.ano}-${String(data.mes).padStart(2, "0")}.csv`
  );
  return res.send(`\uFEFF${csv}`);
}


function editStatus(req, res) {
  return saveObservation(req, res);
}

function exportXLS(req, res) {
  return exportCSV(req, res);
}
module.exports = {
  index,
  viewMonth,
  recalculate,
  editStatus,
  saveNC,
  saveObservation,
  exportPDF,
  exportCSV,
  exportXLS,
};
