const fs = require("node:fs");
const path = require("node:path");
const PDFDocument = require("pdfkit");

const COLORS = {
  primary: "#1F6F43",
  primaryDark: "#1F6F43",
  text: "#0f172a",
  muted: "#334155",
  border: "#cbd5e1",
  light: "#f8fafc",
  stripe: "#eef6f0",
};

const HEADER_HEIGHT = 74;
const CONTENT_START_Y = 92;
const FOOTER_Y_OFFSET = 45;

const LOGO_PATH = path.resolve(process.cwd(), "public/IMG/login_campo_do_gado.png.png.png");

function formatDateBr(dateISO) {
  if (!dateISO) return "-";
  const [year, month, day] = String(dateISO).slice(0, 10).split("-");
  if (!year || !month || !day) return String(dateISO);
  return `${day}/${month}/${year}`;
}

function formatDiaSemana(dateISO) {
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const d = new Date(`${String(dateISO).slice(0, 10)}T00:00:00Z`);
  return dias[d.getUTCDay()] || "-";
}

function withPdf(res, fileName) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${fileName}`);
  doc.pipe(res);
  return doc;
}

function drawHeader(doc, title, subtitle) {
  doc.rect(0, 0, doc.page.width, HEADER_HEIGHT).fill(COLORS.primary);

  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, 36, 8, { fit: [62, 62] });
  }

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16).text(title, 110, 22, {
    align: "center",
    width: doc.page.width - 150,
  });

  doc.fillColor("#e7f8ec").font("Helvetica").fontSize(10).text(subtitle, 110, 46, {
    align: "center",
    width: doc.page.width - 150,
  });

  doc.y = CONTENT_START_Y;
}

function drawFooter(doc, yearText = "2026") {
  const footer = `Campo do Gado – Manutenção Industrial – ${yearText}`;
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text(footer, 40, doc.page.height - FOOTER_Y_OFFSET, {
    align: "center",
    width: doc.page.width - 80,
    lineBreak: false,
  });
}

function drawTableHeader(doc, columns, startX, y, rowHeight) {
  doc.save();
  doc.rect(startX, y, columns.reduce((acc, c) => acc + c.width, 0), rowHeight).fill(COLORS.primary);

  let x = startX;
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(9);
  for (const col of columns) {
    doc.text(col.label, x + 4, y + 6, { width: col.width - 8, align: "center" });
    x += col.width;
  }

  doc.restore();
}

function drawTableRow(doc, columns, startX, y, rowHeight, row, striped = false) {
  const totalWidth = columns.reduce((acc, c) => acc + c.width, 0);
  doc.save();
  if (striped) {
    doc.rect(startX, y, totalWidth, rowHeight).fill(COLORS.stripe);
  }
  doc.rect(startX, y, totalWidth, rowHeight).lineWidth(0.5).strokeColor(COLORS.border).stroke();

  let x = startX;
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.text);
  for (const col of columns) {
    const value = String(row[col.key] || "-");
    doc.text(value, x + 4, y + 4, { width: col.width - 8, align: col.align || "left" });
    doc.moveTo(x, y).lineTo(x, y + rowHeight).lineWidth(0.5).strokeColor(COLORS.border).stroke();
    x += col.width;
  }
  doc.moveTo(x, y).lineTo(x, y + rowHeight).lineWidth(0.5).strokeColor(COLORS.border).stroke();

  doc.restore();
}

function funcaoAgrupada(nomesPorFuncao = {}) {
  const partes = [];
  if (nomesPorFuncao.mecanico?.length) partes.push(`Mecânico: ${nomesPorFuncao.mecanico.join(", ")}`);
  if (nomesPorFuncao.auxiliar?.length) partes.push(`Auxiliar: ${nomesPorFuncao.auxiliar.join(", ")}`);
  if (nomesPorFuncao.operacional?.length) partes.push(`Operacional: ${nomesPorFuncao.operacional.join(", ")}`);
  return partes.length ? partes.join(" | ") : "-";
}

function renderEscalaSemanalPdf(res, { rows = [] }) {
  const doc = withPdf(res, "escala-semanal-manutencao-industrial.pdf");
  drawHeader(
    doc,
    "ESCALA SEMANAL – MANUTENÇÃO INDUSTRIAL",
    "Campo do Gado – Setor de Manutenção Industrial"
  );

  const columns = [
    { key: "semana", label: "Semana", width: 55, align: "center" },
    { key: "periodo", label: "Período (serviço)", width: 120, align: "center" },
    { key: "noturno", label: "Turno noturno (19h–05h)", width: 122, align: "left" },
    { key: "diurno", label: "Turno diurno (07h–17h)", width: 122, align: "left" },
    { key: "apoio", label: "Apoio operacional (diurno)", width: 122, align: "left" },
  ];

  const rowHeight = 42;
  const startX = 40;
  let y = 102;

  drawTableHeader(doc, columns, startX, y, 26);
  y += 26;

  if (!rows.length) {
    drawTableRow(
      doc,
      columns,
      startX,
      y,
      30,
      {
        semana: "-",
        periodo: "-",
        noturno: "Não há dados de escala semanal cadastrados.",
        diurno: "-",
        apoio: "-",
      },
      false
    );
    doc.end();
    return;
  }

  rows.forEach((row, index) => {
    if (y + rowHeight > doc.page.height - 70) {
      drawFooter(doc, "2026");
      doc.addPage();
      drawHeader(
        doc,
        "ESCALA SEMANAL – MANUTENÇÃO INDUSTRIAL",
        "Campo do Gado – Setor de Manutenção Industrial"
      );
      y = 102;
      drawTableHeader(doc, columns, startX, y, 26);
      y += 26;
    }

    drawTableRow(
      doc,
      columns,
      startX,
      y,
      rowHeight,
      {
        semana: row.semana,
        periodo: row.periodo,
        noturno: funcaoAgrupada(row.noturno),
        diurno: funcaoAgrupada(row.diurno),
        apoio: funcaoAgrupada(row.apoio),
      },
      index % 2 !== 0
    );

    y += rowHeight;
  });

  drawFooter(doc, "2026");
  doc.end();
}

function renderEscalaPeriodoPdf(res, { start, end, baseResumo = "", concessoes = [] }) {
  const doc = withPdf(res, `escala-folgas-${start}-a-${end}.pdf`);
  drawHeader(
    doc,
    "ESCALA DE FOLGAS – MANUTENÇÃO INDUSTRIAL",
    "Campo do Gado – Manutenção Industrial"
  );

  let y = 104;

  function ensurePage(space = 20, title = "ESCALA DE FOLGAS – MANUTENÇÃO INDUSTRIAL") {
    if (y + space <= doc.page.height - 70) return;
    drawFooter(doc, "2026");
    doc.addPage();
    drawHeader(
      doc,
      title,
      "Campo do Gado – Manutenção Industrial"
    );
    y = 104;
  }

  doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text(`Período: ${formatDateBr(start)} até ${formatDateBr(end)}`, 40, y);
  y += 24;

  doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.primaryDark).text("1. Base do serviço (resumo curto)", 40, y);
  y += 18;
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.text).text(baseResumo || "Sem registros de serviço no período informado.", 40, y, {
    width: 520,
  });
  y = doc.y + 16;

  ensurePage(56);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.primaryDark).text("2. Concessão (folgas e atestados)", 40, y);
  y += 14;

  const columns = [
    { key: "data", label: "Data", width: 95, align: "center" },
    { key: "tipo", label: "Tipo (Folga ou Atestado)", width: 125, align: "center" },
    { key: "colaborador", label: "Colaborador", width: 150, align: "left" },
    { key: "motivo", label: "Motivo (opcional)", width: 180, align: "left" },
  ];

  drawTableHeader(doc, columns, 40, y, 24);
  y += 24;

  if (!concessoes.length) {
    drawTableRow(doc, columns, 40, y, 28, {
      data: "-",
      tipo: "-",
      colaborador: "Sem registros de folga/atestado no período.",
      motivo: "-",
    });
    y += 28;
  } else {
    concessoes.forEach((f, index) => {
      ensurePage(34);
      drawTableRow(doc, columns, 40, y, 28, {
        data: formatDateBr(f.data),
        tipo: f.tipo,
        colaborador: f.colaborador,
        motivo: f.motivo || "-",
      }, index % 2 !== 0);
      y += 28;
    });
  }

  drawFooter(doc, "2026");
  doc.end();
}

module.exports = {
  renderEscalaSemanalPdf,
  renderEscalaPeriodoPdf,
  formatDateBr,
};
