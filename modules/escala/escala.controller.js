const service = require("./escala.service");
const PDFDocument = require("pdfkit");

exports.index = (req, res, next) => {
  try {
    const semanaAtual = service.getSemanaAtual();
    res.render("escala/index", { semanaAtual });
  } catch (err) {
    next(err);
  }
};

exports.completa = (req, res, next) => {
  try {
    const semanas = service.getEscalaCompleta();
    res.render("escala/completa", { semanas });
  } catch (err) {
    next(err);
  }
};

exports.editarSemana = (req, res, next) => {
  try {
    const semana = service.getSemanaById(req.params.id);
    if (!semana) return res.status(404).send("Semana não encontrada");

    res.render("escala/editar", { semana });
  } catch (err) {
    next(err);
  }
};

exports.salvarEdicao = (req, res, next) => {
  try {
    const { alocacaoId, novoTurno } = req.body;

    if (!alocacaoId || !novoTurno) {
      return res.status(400).send("Dados inválidos");
    }

    service.atualizarTurno(alocacaoId, novoTurno);
    res.redirect("/escala");
  } catch (err) {
    next(err);
  }
};

exports.gerarPdf = (req, res, next) => {
  try {
    const semana = service.getSemanaById(req.params.id);
    if (!semana) return res.status(404).send("Semana não encontrada");

    const doc = new PDFDocument();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=escala-semana-${semana.semana_numero}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(18).text("ESCALA SEMANAL - CAMPO DO GADO", {
      align: "center",
    });

    doc.moveDown();
    doc.fontSize(14).text(`Semana ${semana.semana_numero}`);
    doc.text(`Período: ${semana.data_inicio} até ${semana.data_fim}`);
    doc.moveDown();

    if (semana.alocacoes && semana.alocacoes.length > 0) {
      semana.alocacoes.forEach((a) => {
        doc.text(`${a.nome} - ${a.tipo_turno}`);
      });
    } else {
      doc.text("Nenhuma alocação cadastrada.");
    }

    doc.end();
  } catch (err) {
    next(err);
  }
};
