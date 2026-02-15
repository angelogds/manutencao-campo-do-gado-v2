const service = require("./escala.service");
const PDFDocument = require("pdfkit");

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

exports.index = (req, res, next) => {
  try {
    res.locals.activeMenu = "escala";

    const date = String(req.query?.date || "").slice(0, 10);
    const alvo = date || isoToday();

    const semana = service.getSemanaPorData(alvo);
    const publicacoes = service.getPublicacoes();

    return res.render("escala/index", {
      title: "Escala",
      alvo,
      semana,
      publicacoes,
    });
  } catch (e) {
    next(e);
  }
};

exports.completa = (req, res, next) => {
  try {
    res.locals.activeMenu = "escala";
    const semanas = service.getEscalaCompletaComTimes();
    return res.render("escala/completa", { title: "Escala Completa", semanas });
  } catch (e) {
    next(e);
  }
};

exports.adicionarRapido = (req, res, next) => {
  try {
    const date = String(req.body?.date || "").slice(0, 10) || isoToday();
    const nome = String(req.body?.nome || "").trim();
    const turno = String(req.body?.turno || "").trim().toLowerCase(); // dia/noite/apoio
    const setor = String(req.body?.setor || "Manutenção").trim();

    if (!nome) {
      req.flash("error", "Informe o nome do colaborador.");
      return res.redirect(`/escala?date=${date}`);
    }

    const tipo_turno =
      turno === "noite" ? "noturno" :
      turno === "dia" ? "diurno" :
      turno === "apoio" ? "apoio" :
      "";

    if (!tipo_turno) {
      req.flash("error", "Turno inválido. Use: Dia, Noite ou Apoio.");
      return res.redirect(`/escala?date=${date}`);
    }

    service.adicionarRapido({ date, nome, tipo_turno, setor });

    req.flash("success", "Adicionado com sucesso na semana do sistema.");
    return res.redirect(`/escala?date=${date}`);
  } catch (e) {
    next(e);
  }
};

exports.lancarAusencia = (req, res, next) => {
  try {
    const date = String(req.body?.date || "").slice(0, 10) || isoToday();
    const nome = String(req.body?.nome || "").trim();
    const tipo = String(req.body?.tipo || "").trim().toLowerCase(); // folga | atestado
    const inicio = String(req.body?.inicio || "").slice(0, 10);
    const fim = String(req.body?.fim || "").slice(0, 10);
    const motivo = String(req.body?.motivo || "").trim();

    if (!nome || !inicio || !fim || !tipo) {
      req.flash("error", "Preencha: Nome, Tipo (folga/atestado), Início e Fim.");
      return res.redirect(`/escala?date=${date}`);
    }

    if (inicio > fim) {
      req.flash("error", "Data início não pode ser maior que data fim.");
      return res.redirect(`/escala?date=${date}`);
    }

    if (tipo !== "folga" && tipo !== "atestado") {
      req.flash("error", "Tipo inválido (use folga ou atestado).");
      return res.redirect(`/escala?date=${date}`);
    }

    service.lancarAusencia({ nome, tipo, inicio, fim, motivo });

    req.flash("success", "Ausência lançada. A semana já vai reconhecer automaticamente.");
    return res.redirect(`/escala?date=${date}`);
  } catch (e) {
    next(e);
  }
};

exports.editarSemana = (req, res, next) => {
  try {
    res.locals.activeMenu = "escala";
    const semanaId = Number(req.params.id);
    const semana = service.getSemanaById(semanaId);
    if (!semana) return res.status(404).send("Semana não encontrada");

    return res.render("escala/editar", { title: "Editar Semana", semana });
  } catch (e) {
    next(e);
  }
};

exports.salvarEdicao = (req, res, next) => {
  try {
    const semanaId = Number(req.params.id);
    const alocacaoId = Number(req.body?.alocacaoId);
    const novoTurno = String(req.body?.novoTurno || "").trim().toLowerCase();

    const tipo_turno =
      novoTurno === "noturno" || novoTurno === "noite" ? "noturno" :
      novoTurno === "diurno" || novoTurno === "dia" ? "diurno" :
      novoTurno === "apoio" ? "apoio" :
      novoTurno === "folga" ? "folga" :
      novoTurno === "plantao" ? "plantao" :
      "";

    if (!alocacaoId || !tipo_turno) {
      req.flash("error", "Dados inválidos para edição.");
      return res.redirect(`/escala/editar/${semanaId}`);
    }

    service.atualizarTurno(alocacaoId, tipo_turno);

    req.flash("success", "Turno atualizado.");
    return res.redirect(`/escala/editar/${semanaId}`);
  } catch (e) {
    next(e);
  }
};

exports.pdfSemana = (req, res, next) => {
  try {
    const semanaId = Number(req.params.id);
    const semana = service.getSemanaById(semanaId);
    if (!semana) return res.status(404).send("Semana não encontrada");

    const doc = new PDFDocument({ margin: 36 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=escala-semana-${semana.semana_numero}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(16).text("CAMPO DO GADO - ESCALA SEMANAL", { align: "center" });
    doc.moveDown(0.6);
    doc.fontSize(11).text(`Semana: ${semana.semana_numero}`);
    doc.text(`Período: ${semana.data_inicio} até ${semana.data_fim}`);
    doc.text(`Setor: Manutenção`);
    doc.moveDown(0.8);

    const linhas = service.getLinhasSemanaComStatus(semanaId);

    doc.fontSize(12).text("Colaboradores da Semana", { underline: true });
    doc.moveDown(0.4);

    linhas.forEach((l) => {
      doc.fontSize(11).text(`${l.nome}  |  ${l.turnoLabel}  |  ${l.setor}  |  ${l.statusLabel}`);
    });

    doc.moveDown(1);
    doc.fontSize(9).text(`Gerado em: ${new Date().toISOString()}`, { align: "right" });

    doc.end();
  } catch (e) {
    next(e);
  }
};

exports.pdfPeriodo = (req, res, next) => {
  try {
    const start = String(req.query?.start || "").slice(0, 10);
    const end = String(req.query?.end || "").slice(0, 10);

    if (!start || !end) {
      return res.status(400).send("Informe start e end (YYYY-MM-DD).");
    }
    if (start > end) return res.status(400).send("start não pode ser maior que end.");

    const semanas = service.getSemanasNoPeriodo(start, end);

    const doc = new PDFDocument({ margin: 36 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=escala-${start}-ate-${end}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).text("CAMPO DO GADO - ESCALA POR PERÍODO", { align: "center" });
    doc.moveDown(0.6);
    doc.fontSize(11).text(`Período solicitado: ${start} até ${end}`);
    doc.text("Setor: Manutenção");
    doc.moveDown(0.8);

    semanas.forEach((semana) => {
      doc.fontSize(12).text(`Semana ${semana.semana_numero} (${semana.data_inicio} a ${semana.data_fim})`, { underline: true });
      const linhas = service.getLinhasSemanaComStatus(semana.id);
      doc.moveDown(0.2);
      linhas.forEach((l) => doc.fontSize(10).text(`- ${l.nome} | ${l.turnoLabel} | ${l.statusLabel}`));
      doc.moveDown(0.6);
    });

    doc.end();
  } catch (e) {
    next(e);
  }
};
