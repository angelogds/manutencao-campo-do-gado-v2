const service = require("./escala.service");
const PDFDocument = require("pdfkit");

exports.index = (req, res) => {
  const semanaAtual = service.getSemanaAtual();
  res.render("escala/index", { semanaAtual });
};

exports.completa = (req, res) => {
  const semanas = service.getEscalaCompleta();
  res.render("escala/completa", { semanas });
};

exports.editarSemana = (req, res) => {
  const semana = service.getSemanaById(req.params.id);
  res.render("escala/editar", { semana });
};

exports.salvarEdicao = (req, res) => {
  const { alocacaoId, novoTurno } = req.body;
  service.atualizarTurno(alocacaoId, novoTurno);
  res.redirect("/escala");
};

exports.gerarPdf = (req, res) => {
  const semana = service.getSemanaById(req.params.id);
  if (!semana) return res.send("Semana não encontrada");

  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=escala.pdf");

  doc.pipe(res);

  doc.fontSize(18).text("ESCALA SEMANAL - CAMPO DO GADO", { align: "center" });
  doc.moveDown();

  doc.fontSize(14).text(`Semana ${semana.semana_numero}`);
  doc.text(`Período: ${semana.data_inicio} até ${semana.data_fim}`);
  doc.moveDown();

  semana.alocacoes.forEach(a => {
    doc.text(`${a.nome} - ${a.tipo_turno}`);
  });

  doc.end();
};
