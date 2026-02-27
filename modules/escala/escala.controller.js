const fs = require("node:fs");
const path = require("node:path");
const service = require("./escala.service");
const PDFDocument = require("pdfkit");

const PDF_COLORS = {
  green: "#166534",
  text: "#0f172a",
  line: "#334155",
  muted: "#475569",
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function daysInclusive(start, end) {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  return Math.floor((e - s) / 86400000) + 1;
}

function formatDateBr(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(iso || "");
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function turnoCell(turnoData) {
  const nomes = [
    ...(turnoData?.mecanico || []),
    ...(turnoData?.auxiliar || []),
    ...(turnoData?.operacional || []),
  ];
  const unicos = [...new Set(nomes)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return unicos.length ? unicos.join(", ") : "-";
}

function drawHeader(doc, title, subtitle, periodoLabel) {
  const margin = doc.page.margins.left;
  const usableWidth = doc.page.width - margin * 2;

  doc.save();
  doc.rect(0, 0, doc.page.width, 74).fill(PDF_COLORS.green);
  doc.restore();

  const logoPath = path.join(__dirname, "../../public/IMG/login_campo_do_gado.png.png.png");
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, margin, 18, { fit: [85, 35] });
    } catch (_e) {
      // fallback silencioso para não quebrar geração
    }
  }

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(19)
    .text(title, margin + 94, 17, { width: usableWidth - 94, align: "left" });
  doc.font("Helvetica").fontSize(10)
    .text(subtitle, margin + 94, 46, { width: usableWidth - 94, align: "left" });

  doc.moveDown(1.9);
  doc.fillColor(PDF_COLORS.text).font("Helvetica-Bold").fontSize(12)
    .text("Campo do Gado – Setor de Manutenção Industrial", { align: "center" });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor(PDF_COLORS.muted)
    .text(periodoLabel, { align: "center" });
  doc.moveDown(0.8);
}

function drawTable(doc, rows) {
  const margin = doc.page.margins.left;
  const usable = doc.page.width - margin * 2;

  const cols = {
    semana: Math.floor(usable * 0.1),
    periodo: Math.floor(usable * 0.26),
    noturno: Math.floor(usable * 0.21),
    diurno: Math.floor(usable * 0.21),
    apoio: usable - Math.floor(usable * 0.1) - Math.floor(usable * 0.26) - Math.floor(usable * 0.21) - Math.floor(usable * 0.21),
  };

  const x = {
    semana: margin,
    periodo: margin + cols.semana,
    noturno: margin + cols.semana + cols.periodo,
    diurno: margin + cols.semana + cols.periodo + cols.noturno,
    apoio: margin + cols.semana + cols.periodo + cols.noturno + cols.diurno,
  };

  const headerH = 36;
  const baseH = 32;

  const ensureSpace = (h) => {
    if (doc.y + h > doc.page.height - 44) doc.addPage();
  };

  const drawHeaderRow = () => {
    ensureSpace(headerH + 2);
    const y = doc.y;

    doc.save();
    doc.rect(margin, y, usable, headerH).fill(PDF_COLORS.green);
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
    doc.text("Semana", x.semana + 3, y + 10, { width: cols.semana - 6, align: "center" });
    doc.text("Período (serviço)", x.periodo + 3, y + 10, { width: cols.periodo - 6, align: "center" });
    doc.text("Turno noturno\n(19h–05h)", x.noturno + 3, y + 5, { width: cols.noturno - 6, align: "center" });
    doc.text("Turno diurno\n(07h–17h)", x.diurno + 3, y + 5, { width: cols.diurno - 6, align: "center" });
    doc.text("Apoio operacional\n(diurno)", x.apoio + 3, y + 5, { width: cols.apoio - 6, align: "center" });

    doc.y = y + headerH;
  };

  drawHeaderRow();

  if (!rows.length) {
    ensureSpace(baseH);
    const y = doc.y;
    doc.rect(margin, y, usable, baseH).stroke(PDF_COLORS.line);
    doc.font("Helvetica").fontSize(10).fillColor(PDF_COLORS.muted)
      .text("Nenhum registro encontrado para o filtro informado.", margin + 6, y + 10, {
        width: usable - 12,
        align: "center",
      });
    doc.y = y + baseH + 8;
    return;
  }

  rows.forEach((r, idx) => {
    const heights = [
      doc.heightOfString(String(r.semana), { width: cols.semana - 6 }),
      doc.heightOfString(r.periodo, { width: cols.periodo - 6 }),
      doc.heightOfString(r.noturno, { width: cols.noturno - 6 }),
      doc.heightOfString(r.diurno, { width: cols.diurno - 6 }),
      doc.heightOfString(r.apoio, { width: cols.apoio - 6 }),
    ];
    const rowH = Math.max(baseH, Math.ceil(Math.max(...heights)) + 10);

    if (doc.y + rowH > doc.page.height - 44) {
      doc.addPage();
      drawHeaderRow();
    }

    const y = doc.y;

    if (idx % 2) {
      doc.save();
      doc.rect(margin, y, usable, rowH).fill("#f8fafc");
      doc.restore();
    }

    doc.rect(margin, y, usable, rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x.periodo, y).lineTo(x.periodo, y + rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x.noturno, y).lineTo(x.noturno, y + rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x.diurno, y).lineTo(x.diurno, y + rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x.apoio, y).lineTo(x.apoio, y + rowH).stroke(PDF_COLORS.line);

    doc.font("Helvetica").fontSize(9.5).fillColor(PDF_COLORS.text);
    doc.text(String(r.semana), x.semana + 3, y + 6, { width: cols.semana - 6, align: "center" });
    doc.text(r.periodo, x.periodo + 3, y + 6, { width: cols.periodo - 6, align: "center" });
    doc.text(r.noturno, x.noturno + 3, y + 6, { width: cols.noturno - 6, align: "left" });
    doc.text(r.diurno, x.diurno + 3, y + 6, { width: cols.diurno - 6, align: "left" });
    doc.text(r.apoio, x.apoio + 3, y + 6, { width: cols.apoio - 6, align: "left" });

    doc.y = y + rowH;
  });

  doc.moveDown(0.8);
}

function drawFooter(doc) {
  const year = new Date().getFullYear();
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted)
    .text(`Campo do Gado – Manutenção Industrial • ${year}`, doc.page.margins.left, doc.page.height - 28, {
      width: doc.page.width - doc.page.margins.left * 2,
      align: "center",
    });
}

function renderEscalaPdf({ res, fileName, title, subtitle, periodoLabel, semanas }) {
  const rows = semanas.map((s) => ({
    semana: s.semanaNumero,
    periodo: `${formatDateBr(s.dataInicio)} até ${formatDateBr(s.dataFim)}`,
    noturno: turnoCell(s.turnos.noturno),
    diurno: turnoCell(s.turnos.diurno),
    apoio: turnoCell(s.turnos.apoio),
  }));

  const doc = new PDFDocument({ size: "A4", margin: 32 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${fileName}`);
  doc.pipe(res);

  drawHeader(doc, title, subtitle, periodoLabel);
  drawTable(doc, rows);
  drawFooter(doc);
  doc.end();
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
      pdfStart: String(req.query?.start || semana?.data_inicio || alvo).slice(0, 10),
      pdfEnd: String(req.query?.end || semana?.data_fim || alvo).slice(0, 10),
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
    const inicio = String(req.body?.inicio || "").slice(0, 10);
    const fim = String(req.body?.fim || "").slice(0, 10);
    const nome = String(req.body?.nome || "").trim();
    const turno = service.normalizeTurno(req.body?.turno);
    const funcao = service.normalizeFuncao(req.body?.funcao);
    const dateRef = inicio || String(req.body?.date || "").slice(0, 10) || isoToday();

    if (!inicio || !fim) {
      req.flash("error", "Preencha início e fim do período.");
      return res.redirect(`/escala?date=${dateRef}`);
    }
    if (fim < inicio) {
      req.flash("error", "Data final não pode ser menor que data inicial.");
      return res.redirect(`/escala?date=${inicio}`);
    }
    if (!nome) {
      req.flash("error", "Informe o nome do colaborador.");
      return res.redirect(`/escala?date=${inicio}`);
    }
    if (!turno) {
      req.flash("error", "Turno inválido. Use Dia, Noite, Apoio ou Plantão.");
      return res.redirect(`/escala?date=${inicio}`);
    }
    if (!funcao) {
      req.flash("error", "Função inválida. Use Mecânico ou Auxiliar.");
      return res.redirect(`/escala?date=${inicio}`);
    }

    const resultado = service.adicionarRapidoPeriodo({
      inicio,
      fim,
      nome,
      tipo_turno: turno,
      funcao,
    });

    let msg = `Período salvo com sucesso (${resultado.semanasAfetadas} semana(s): ${resultado.inserted} inserção(ões), ${resultado.updated} atualização(ões), ${resultado.ignored} sem alterações).`;
    if (resultado.diasSemSemana > 0) {
      msg += ` ${resultado.diasSemSemana} dia(s) do período não possuem semana cadastrada e foram ignorados.`;
    }

    req.flash("success", msg);
    return res.redirect(`/escala?date=${inicio}`);
  } catch (e) {
    next(e);
  }
};

exports.lancarAusencia = (req, res, next) => {
  try {
    const date = String(req.body?.date || "").slice(0, 10) || isoToday();
    const nome = String(req.body?.nome || "").trim();
    const tipo = String(req.body?.tipo || "").trim().toLowerCase();
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

exports.pdfSemanaAtual = (req, res, next) => {
  try {
    const date = String(req.query?.date || "").slice(0, 10) || isoToday();
    const semana = service.getSemanaPorData(date);
    if (!semana) {
      return res.status(404).send("Semana não encontrada para a data informada.");
    }

    const semanas = service.getEscalaPorPeriodo(semana.data_inicio, semana.data_fim);

    return renderEscalaPdf({
      res,
      fileName: `escala-semana-${semana.semana_numero}.pdf`,
      title: "ESCALA SEMANAL – TURNO NOTURNO + TURNO DIURNO",
      subtitle: "Relatório semanal",
      periodoLabel: `Período: ${formatDateBr(semana.data_inicio)} até ${formatDateBr(semana.data_fim)}`,
      semanas,
    });
  } catch (e) {
    next(e);
  }
};

exports.pdfSemana = (req, res, next) => {
  try {
    const semanaId = Number(req.params.id);
    const semana = service.getSemanaById(semanaId);
    if (!semana) return res.status(404).send("Semana não encontrada");

    const semanas = service.getEscalaPorPeriodo(semana.data_inicio, semana.data_fim);

    return renderEscalaPdf({
      res,
      fileName: `escala-semana-${semana.semana_numero}.pdf`,
      title: "ESCALA SEMANAL – TURNO NOTURNO + TURNO DIURNO",
      subtitle: "Relatório semanal",
      periodoLabel: `Período: ${formatDateBr(semana.data_inicio)} até ${formatDateBr(semana.data_fim)}`,
      semanas,
    });
  } catch (e) {
    next(e);
  }
};

exports.pdfPeriodo = (req, res, next) => {
  try {
    const start = String(req.query?.start || "").slice(0, 10);
    const end = String(req.query?.end || "").slice(0, 10);

    if (!start || !end) {
      return res.status(400).send("Parâmetros obrigatórios: start e end (YYYY-MM-DD).");
    }
    if (start > end) {
      return res.status(400).send("Parâmetro inválido: end deve ser maior ou igual a start.");
    }
    if (daysInclusive(start, end) > 365) {
      return res.status(400).send("Intervalo máximo permitido: 365 dias.");
    }

    const semanas = service.getEscalaPorPeriodo(start, end);

    return renderEscalaPdf({
      res,
      fileName: `escala-${start}-ate-${end}.pdf`,
      title: "ESCALA POR PERÍODO – TURNO NOTURNO + TURNO DIURNO",
      subtitle: "Relatório por período",
      periodoLabel: `Período: ${formatDateBr(start)} até ${formatDateBr(end)}`,
      semanas,
    });
  } catch (e) {
    next(e);
  }
};
