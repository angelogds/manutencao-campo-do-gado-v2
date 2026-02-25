const service = require("./inspecao.service");
const { buildCSV, renderPDF } = require("../../utils/exporters/inspecao.exporter");

function parseMesAno(req) {
  const ano = Number(req.params.ano || new Date().getFullYear());
  const mes = Number(req.params.mes || new Date().getMonth() + 1);
  return { ano, mes };
}

function normalizeStatus(value) {
  const s = String(value || "").toUpperCase();
  if (["C", "NC", "EA", "SP"].includes(s)) return s;
  return "C";
}

function ensureMonthData(req) {
  const { ano, mes } = parseMesAno(req);
  const inspecao = service.getOrCreateInspecao(mes, ano, req.session?.user);
  const equipamentos = service.listEquipamentosAtivos();
  service.recalculate(inspecao.id);
  const matrix = service.buildMatrix(inspecao.id, ano, mes, equipamentos);
  const ncList = service.listNC(inspecao.id);
  const diasMes = service.daysInMonth(ano, mes);
  return { ano, mes, inspecao, equipamentos, matrix, ncList, diasMes };
}

function index(req, res) {
  const d = new Date();
  return res.redirect(`/inspecao/${d.getFullYear()}/${d.getMonth() + 1}`);
}

function viewMonth(req, res) {
  const data = ensureMonthData(req);
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
  const result = service.recalculate(inspecao.id);
  req.flash("success", `Inspeção recalculada com ${result.osCount} OS processadas.`);
  return res.redirect(`/inspecao/${ano}/${mes}`);
}

function editStatus(req, res) {
  const { ano, mes } = parseMesAno(req);
  const inspecao = service.getOrCreateInspecao(mes, ano, req.session?.user);

  service.updateGradeManual(inspecao.id, {
    equipamento_nome: req.body.equipamento_nome,
    dia: Number(req.body.dia),
    status: normalizeStatus(req.body.status),
    observacao: req.body.observacao,
    os_id: req.body.os_id,
  });

  req.flash("success", "Status atualizado manualmente.");
  return res.redirect(`/inspecao/${ano}/${mes}`);
}

function saveNC(req, res) {
  const { ano, mes } = parseMesAno(req);
  const inspecao = service.getOrCreateInspecao(mes, ano, req.session?.user);
  service.saveNC(inspecao.id, req.body);
  req.flash("success", "Não conformidade atualizada.");
  return res.redirect(`/inspecao/${ano}/${mes}`);
}

function exportPDF(req, res) {
  const data = ensureMonthData(req);
  return renderPDF({ res, ...data });
}

function exportXLS(req, res) {
  const data = ensureMonthData(req);
  const csv = buildCSV(data);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=inspecao-pac01-${data.ano}-${String(data.mes).padStart(2, "0")}.csv`
  );
  return res.send(`\uFEFF${csv}`);
}

module.exports = {
  index,
  viewMonth,
  recalculate,
  editStatus,
  saveNC,
  exportPDF,
  exportXLS,
};
