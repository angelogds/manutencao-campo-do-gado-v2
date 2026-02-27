const fs = require("node:fs");
const path = require("node:path");
const service = require("./escala.service");
const PDFDocument = require("pdfkit");

const PDF_COLORS = {
  green: "#15803d",
  text: "#0f172a",
  muted: "#475569",
  line: "#cbd5e1",
  light: "#f8fafc",
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

function normalizeFuncaoPdf(funcao) {
  const f = String(funcao || "").trim().toLowerCase();
  if (f.includes("mecan")) return "Mecânico";
  if (f.includes("aux")) return "Auxiliar";
  return "Operacional";
}

function normalizeTurnoPdf(tipoTurno) {
  const t = String(tipoTurno || "").trim().toLowerCase();
  if (t === "noturno") return "Turno Noturno";
  if (t === "diurno") return "Turno Diurno";
  return "Apoio/Operacional";
}

function buildSemanaRows(semanaId) {
  const linhas = service.getLinhasSemanaComStatus(semanaId);
  const grouped = new Map();

  for (const l of linhas) {
    const turno = normalizeTurnoPdf(l.tipo_turno);
    const funcao = normalizeFuncaoPdf(l.funcaoLabel || l.funcao);
    const key = `${turno}|${funcao}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        turno,
        funcao,
        colaboradores: [],
      });
    }
    grouped.get(key).colaboradores.push(l.nome);
  }

  const ordemTurno = {
    "Turno Noturno": 1,
    "Turno Diurno": 2,
    "Apoio/Operacional": 3,
  };
  const ordemFuncao = { "Mecânico": 1, "Auxiliar": 2, "Operacional": 3 };

  return [...grouped.values()]
    .map((r) => ({ ...r, colaboradores: r.colaboradores.sort((a, b) => a.localeCompare(b, "pt-BR")) }))
    .sort((a, b) => {
      const t = (ordemTurno[a.turno] || 99) - (ordemTurno[b.turno] || 99);
      if (t !== 0) return t;
      return (ordemFuncao[a.funcao] || 99) - (ordemFuncao[b.funcao] || 99);
    });
}

function drawPdfHeader(doc, subtitulo, periodoLabel) {
  const pageWidth = doc.page.width;
  const margin = doc.page.margins.left;
  const usableWidth = pageWidth - margin * 2;

  doc.save();
  doc.rect(0, 0, pageWidth, 70).fill(PDF_COLORS.green);
  doc.restore();

  const logoPath = path.join(__dirname, "../../public/IMG/login_campo_do_gado.png.png.png");
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, margin, 18, { fit: [80, 35] });
    } catch (_e) {
      // não interrompe o PDF se imagem estiver inválida
    }
  }

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(17)
    .text("ESCALA – MANUTENÇÃO INDUSTRIAL", margin + 90, 20, { width: usableWidth - 90, align: "left" });
  doc.font("Helvetica").fontSize(10)
    .text(subtitulo, margin + 90, 43, { width: usableWidth - 90, align: "left" });

  doc.moveDown(1.7);
  doc.fillColor(PDF_COLORS.text).font("Helvetica-Bold").fontSize(11)
    .text(periodoLabel, { align: "left" });
  doc.moveDown(0.4);
}

function drawTabelaSemana(doc, periodoLabel, rows) {
  const margin = doc.page.margins.left;
  const usable = doc.page.width - margin * 2;
  const col = {
    periodo: Math.floor(usable * 0.28),
    turno: Math.floor(usable * 0.21),
    funcao: Math.floor(usable * 0.18),
    colaboradores: usable - Math.floor(usable * 0.28) - Math.floor(usable * 0.21) - Math.floor(usable * 0.18),
  };

  const rowBase = 22;
  const x0 = margin;

  const ensureSpace = (h) => {
    if (doc.y + h > doc.page.height - 60) {
      doc.addPage();
    }
  };

  ensureSpace(36);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(PDF_COLORS.text)
    .text(periodoLabel, x0, doc.y, { width: usable, align: "left" });
  doc.moveDown(0.4);

  const headerY = doc.y;
  doc.save();
  doc.rect(x0, headerY, usable, rowBase).fill(PDF_COLORS.light).stroke(PDF_COLORS.line);
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF_COLORS.text);
  doc.text("Semana/Período", x0 + 6, headerY + 7, { width: col.periodo - 12 });
  doc.text("Turno", x0 + col.periodo + 6, headerY + 7, { width: col.turno - 12 });
  doc.text("Função", x0 + col.periodo + col.turno + 6, headerY + 7, { width: col.funcao - 12 });
  doc.text("Colaboradores", x0 + col.periodo + col.turno + col.funcao + 6, headerY + 7, { width: col.colaboradores - 12 });

  doc.y = headerY + rowBase;

  if (!rows.length) {
    ensureSpace(rowBase);
    doc.rect(x0, doc.y, usable, rowBase).stroke(PDF_COLORS.line);
    doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted)
      .text("Sem registros de escala para este período.", x0 + 8, doc.y + 7, { width: usable - 16, align: "center" });
    doc.y += rowBase + 8;
    return;
  }

  for (const r of rows) {
    const nomes = r.colaboradores.join(", ");
    const hNomes = doc.heightOfString(nomes, { width: col.colaboradores - 12, align: "left" });
    const rowH = Math.max(rowBase, Math.ceil(hNomes) + 10);
    ensureSpace(rowH + 2);

    const y = doc.y;
    doc.rect(x0, y, usable, rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x0 + col.periodo, y).lineTo(x0 + col.periodo, y + rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x0 + col.periodo + col.turno, y).lineTo(x0 + col.periodo + col.turno, y + rowH).stroke(PDF_COLORS.line);
    doc.moveTo(x0 + col.periodo + col.turno + col.funcao, y).lineTo(x0 + col.periodo + col.turno + col.funcao, y + rowH).stroke(PDF_COLORS.line);

    doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.text);
    doc.text(periodoLabel.replace("Período: ", ""), x0 + 6, y + 6, { width: col.periodo - 12 });
    doc.text(r.turno, x0 + col.periodo + 6, y + 6, { width: col.turno - 12 });
    doc.text(r.funcao, x0 + col.periodo + col.turno + 6, y + 6, { width: col.funcao - 12 });
    doc.text(nomes, x0 + col.periodo + col.turno + col.funcao + 6, y + 6, { width: col.colaboradores - 12 });

    doc.y += rowH;
  }

  doc.moveDown(0.7);
}

function drawPdfFooter(doc) {
  const year = new Date().getFullYear();
  const footerY = doc.page.height - 30;
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COLORS.muted)
    .text(`Campo do Gado – Manutenção Industrial • ${year}`, doc.page.margins.left, footerY, {
      width: doc.page.width - doc.page.margins.left * 2,
      align: "center",
    });
}

function renderEscalaPdf({ res, subtitulo, periodoLabel, blocos, fileName }) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${fileName}`);
  doc.pipe(res);

  drawPdfHeader(doc, subtitulo, periodoLabel);

  blocos.forEach((bloco, idx) => {
    if (idx > 0) doc.moveDown(0.6);
    drawTabelaSemana(doc, bloco.periodoLabel, bloco.rows);
  });

  drawPdfFooter(doc);
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

exports.pdfSemana = (req, res, next) => {
  try {
    const semanaId = Number(req.params.id);
    const semana = service.getSemanaById(semanaId);
    if (!semana) return res.status(404).send("Semana não encontrada");

    const periodoLabel = `Período: ${formatDateBr(semana.data_inicio)} a ${formatDateBr(semana.data_fim)}`;
    const rows = buildSemanaRows(semana.id);

    renderEscalaPdf({
      res,
      subtitulo: "Escala Semanal",
      periodoLabel,
      blocos: [{ periodoLabel, rows }],
      fileName: `escala-semana-${semana.semana_numero}.pdf`,
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
    const blocos = semanas.map((s) => ({
      periodoLabel: `Período: ${formatDateBr(s.data_inicio)} a ${formatDateBr(s.data_fim)}`,
      rows: buildSemanaRows(s.id),
    }));

    renderEscalaPdf({
      res,
      subtitulo: "Escala por Período",
      periodoLabel: `Período: ${formatDateBr(start)} a ${formatDateBr(end)}`,
      blocos,
      fileName: `escala-${start}-ate-${end}.pdf`,
    });
  } catch (e) {
    next(e);
  }
};
