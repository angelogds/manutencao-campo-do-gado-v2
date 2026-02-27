const fs = require("node:fs");
const path = require("node:path");
const service = require("./escala.service");

const PDFDocument = require("pdfkit");

const PDF_COLORS = {
  green: "#166534",
  text: "#0f172a",
  line: "#334155",
  muted: "#475569",
  tableHeader: "#166534",
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

function aggregateSemanaTurnos(semanaId) {
  const linhas = service.getLinhasSemanaComStatus(semanaId);

  const nomes = {
    noturno: new Set(),
    diurno: new Set(),
    apoio: new Set(),
  };

  for (const l of linhas) {
    const t = String(l.tipo_turno || "").toLowerCase();
    if (t === "noturno") nomes.noturno.add(l.nome);
    else if (t === "diurno") nomes.diurno.add(l.nome);
    else if (t === "apoio" || t === "plantao") nomes.apoio.add(l.nome);
  }

  const toText = (set) => {
    const arr = [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return arr.length ? arr.join(", ") : "-";
  };

  return {
    noturno: toText(nomes.noturno),
    diurno: toText(nomes.diurno),
    apoio: toText(nomes.apoio),
  };
}

function drawPdfHeader(doc, subtitulo, periodoLabel) {
  const margin = doc.page.margins.left;
  const usableWidth = doc.page.width - margin * 2;

  doc.save();
  doc.rect(0, 0, doc.page.width, 72).fill(PDF_COLORS.green);
  doc.restore();

  const logoPath = path.join(__dirname, "../../public/IMG/login_campo_do_gado.png.png.png");
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, margin, 18, { fit: [85, 35] });
    } catch (_e) {
      // Não quebra o PDF se a imagem estiver inválida/corrompida
    }
  }

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20)
    .text("ESCALA – MANUTENÇÃO INDUSTRIAL", margin + 94, 18, { width: usableWidth - 94, align: "left" });
  doc.font("Helvetica").fontSize(10)
    .text(subtitulo, margin + 94, 46, { width: usableWidth - 94, align: "left" });

  doc.moveDown(1.9);
  doc.fillColor(PDF_COLORS.text).font("Helvetica-Bold").fontSize(12)
    .text("Campo do Gado – Setor de Manutenção Industrial", { align: "center" });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor(PDF_COLORS.muted)
    .text(periodoLabel, { align: "center" });
  doc.moveDown(0.8);
}

function drawEscalaTable(doc, rows) {
  const margin = doc.page.margins.left;
  const usable = doc.page.width - margin * 2;

  const cols = {
    semana: Math.floor(usable * 0.1),
    periodo: Math.floor(usable * 0.25),
    noturno: Math.floor(usable * 0.22),
    diurno: Math.floor(usable * 0.22),
    apoio: usable - Math.floor(usable * 0.1) - Math.floor(usable * 0.25) - Math.floor(usable * 0.22) - Math.floor(usable * 0.22),
  };

  const x = {
    semana: margin,
    periodo: margin + cols.semana,
    noturno: margin + cols.semana + cols.periodo,
    diurno: margin + cols.semana + cols.periodo + cols.noturno,
    apoio: margin + cols.semana + cols.periodo + cols.noturno + cols.diurno,
  };

  const headerH = 34;
  const baseH = 24;

  const ensureSpace = (h) => {
    if (doc.y + h > doc.page.height - 46) {
      doc.addPage();
    }
  };

  const drawHeaderRow = () => {
    ensureSpace(headerH + 2);
    const y = doc.y;
    doc.save();
    doc.rect(margin, y, usable, headerH).fill(PDF_COLORS.tableHeader);
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
    doc.text("Semana", x.semana + 4, y + 9, { width: cols.semana - 8, align: "center" });
    doc.text("Período (serviço)", x.periodo + 4, y + 9, { width: cols.periodo - 8, align: "center" });
    doc.text("Turno noturno\n(19h–05h)", x.noturno + 4, y + 4, { width: cols.noturno - 8, align: "center" });
    doc.text("Turno diurno\n(07h–17h)", x.diurno + 4, y + 4, { width: cols.diurno - 8, align: "center" });
    doc.text("Apoio operacional\n(diurno)", x.apoio + 4, y + 4, { width: cols.apoio - 8, align: "center" });

    doc.y = y + headerH;
  };

  drawHeaderRow();

  if (!rows.length) {
    ensureSpace(baseH);
    const y = doc.y;
    doc.rect(margin, y, usable, baseH).stroke(PDF_COLORS.line);
    doc.font("Helvetica").fontSize(10).fillColor(PDF_COLORS.muted)
      .text("Nenhum registro encontrado para o período selecionado.", margin + 6, y + 7, {
        width: usable - 12,
        align: "center",
      });
    doc.y = y + baseH + 8;
    return;
  }

  doc.font("Helvetica").fontSize(10).fillColor(PDF_COLORS.text);

  rows.forEach((r, idx) => {
    const h1 = doc.heightOfString(r.periodo, { width: cols.periodo - 8 });
    const h2 = doc.heightOfString(r.noturno, { width: cols.noturno - 8 });
    const h3 = doc.heightOfString(r.diurno, { width: cols.diurno - 8 });
    const h4 = doc.heightOfString(r.apoio, { width: cols.apoio - 8 });
    const rowH = Math.max(baseH, Math.ceil(Math.max(h1, h2, h3, h4)) + 10);

    if (doc.y + rowH > doc.page.height - 46) {
      doc.addPage();
      drawHeaderRow();
    }

    const y = doc.y;

    // fundo alternado leve
    if (idx % 2 === 1) {
      doc.save();
      doc.rect(margin, y, usable, rowH).fill("#f8fafc");
      doc.restore();
    }

    doc.rect(margin, y, usable, rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x.periodo, y).lineTo(x.periodo, y + rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x.noturno, y).lineTo(x.noturno, y + rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x.diurno, y).lineTo(x.diurno, y + rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x.apoio, y).lineTo(x.apoio, y + rowH).stroke(PDF_COLORS.line);

    doc.text(String(r.semana), x.semana + 4, y + 6, { width: cols.semana - 8, align: "center" });
    doc.text(r.periodo, x.periodo + 4, y + 6, { width: cols.periodo - 8, align: "center" });
    doc.text(r.noturno, x.noturno + 4, y + 6, { width: cols.noturno - 8, align: "center" });
    doc.text(r.diurno, x.diurno + 4, y + 6, { width: cols.diurno - 8, align: "center" });
    doc.text(r.apoio, x.apoio + 4, y + 6, { width: cols.apoio - 8, align: "center" });

    doc.y = y + rowH;
  });

  doc.moveDown(0.8);
}

function drawPdfFooter(doc) {
  const year = new Date().getFullYear();
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted)
    .text(`Campo do Gado – Manutenção Industrial • ${year}`, doc.page.margins.left, doc.page.height - 28, {
      width: doc.page.width - doc.page.margins.left * 2,
      align: "center",
    });
}

function renderEscalaPdf({ res, fileName, subtitulo, periodoLabel, rows }) {
  const doc = new PDFDocument({ size: "A4", margin: 32 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${fileName}`);
  doc.pipe(res);

  drawPdfHeader(doc, subtitulo, periodoLabel);
  drawEscalaTable(doc, rows);
  drawPdfFooter(doc);

  doc.end();
}

function makeRowFromSemana(semana) {
  const agg = aggregateSemanaTurnos(semana.id);
  return {
    semana: semana.semana_numero,
    periodo: `${formatDateBr(semana.data_inicio)} até ${formatDateBr(semana.data_fim)}`,
    noturno: agg.noturno,
    diurno: agg.diurno,
    apoio: agg.apoio,
  };
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
      req.flash("error", "Não existe semana cadastrada para esta data.");
      return res.redirect(`/escala?date=${date}`);
    }

    const row = makeRowFromSemana(semana);

    renderEscalaPdf({
      res,
      fileName: `escala-semana-${semana.semana_numero}.pdf`,
      subtitulo: "Escala Semanal",
      periodoLabel: `Período: ${formatDateBr(semana.data_inicio)} a ${formatDateBr(semana.data_fim)}`,
      rows: [row],
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

    const row = makeRowFromSemana(semana);

    renderEscalaPdf({
      res,
      fileName: `escala-semana-${semana.semana_numero}.pdf`,
      subtitulo: "Escala Semanal",
      periodoLabel: `Período: ${formatDateBr(semana.data_inicio)} a ${formatDateBr(semana.data_fim)}`,
      rows: [row],
    });
  } catch (e) {
    next(e);
  }
};

exports.pdfPeriodo = (req, res, next) => {
  try {
    const start = String(req.query?.start || "").slice(0, 10);
    const end = String(req.query?.end || "").slice(0, 10);
    const dateRef = start || isoToday();

    if (!start || !end) {
      req.flash("error", "Informe início e fim para gerar o PDF por período.");
      return res.redirect(`/escala?date=${dateRef}`);
    }
    if (start > end) {
      req.flash("error", "A data final do PDF não pode ser menor que a inicial.");
      return res.redirect(`/escala?date=${dateRef}`);
    }
    if (daysInclusive(start, end) > 365) {
      req.flash("error", "O PDF por período permite no máximo 365 dias.");
      return res.redirect(`/escala?date=${dateRef}`);
    }

    const semanas = service.getSemanasNoPeriodo(start, end);
    const rows = semanas.map((s) => makeRowFromSemana(s));

    renderEscalaPdf({
      res,
      fileName: `escala-${start}-ate-${end}.pdf`,
      subtitulo: "Escala por Período",
      periodoLabel: `Período: ${formatDateBr(start)} a ${formatDateBr(end)}`,
      rows,
    });
  } catch (e) {
    next(e);
  }
};
