const fs = require("node:fs");
const path = require("node:path");
const PDFDocument = require("pdfkit");

const PAGE = {
  size: "A4",
  margin: { left: 36, right: 36, top: 28, bottom: 32 },
};

const COLORS = {
  headerGreen: "#1F6F43",
  text: "#0f172a",
  muted: "#475569",
  border: "#cbd5e1",
  headerText: "#ffffff",
  tableHeaderText: "#ffffff",
  sectionTitle: "#14532d",
};

const HEADER_HEIGHT = 72;
const FOOTER_HEIGHT = 28;
const HEADER_GAP = 14;
const TABLE_HEADER_HEIGHT = 24;
const CELL_PADDING = 6;

const LOGO_CANDIDATES = [
  path.resolve(process.cwd(), "public/IMG/logopdf_campo_do_gado.png.png"),
  path.resolve(process.cwd(), "public/IMG/login_campo_do_gado.png.png.png"),
];

function getLogoPath() {
  return LOGO_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || null;
}

function formatDateBr(dateISO) {
  if (!dateISO) return "-";
  const [year, month, day] = String(dateISO).slice(0, 10).split("-");
  if (!year || !month || !day) return String(dateISO);
  return `${day}/${month}/${year}`;
}

function createDoc() {
  return new PDFDocument({ size: PAGE.size, margins: PAGE.margin, autoFirstPage: true });
}

function contentStartY(doc) {
  return PAGE.margin.top + HEADER_HEIGHT + HEADER_GAP;
}

function contentEndY(doc) {
  return doc.page.height - PAGE.margin.bottom - FOOTER_HEIGHT;
}

function drawFooter(doc, { text }) {
  const lineY = doc.page.height - PAGE.margin.bottom - FOOTER_HEIGHT;
  doc.save();
  doc.lineWidth(0.7).strokeColor(COLORS.border)
    .moveTo(PAGE.margin.left, lineY)
    .lineTo(doc.page.width - PAGE.margin.right, lineY)
    .stroke();

  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8.5).text(
    text,
    PAGE.margin.left,
    lineY + 8,
    { width: doc.page.width - PAGE.margin.left - PAGE.margin.right, align: "center" }
  );
  doc.restore();
}

function drawHeader(doc, { title, subtitle, logoPath }) {
  const x = PAGE.margin.left;
  const y = PAGE.margin.top;
  const width = doc.page.width - PAGE.margin.left - PAGE.margin.right;

  doc.save();
  doc.roundedRect(x, y, width, HEADER_HEIGHT, 8).fill(COLORS.headerGreen);

  if (logoPath && fs.existsSync(logoPath)) {
    doc.image(logoPath, x + 10, y + 8, { fit: [86, 56], align: "left", valign: "center" });
  }

  doc.fillColor(COLORS.headerText).font("Helvetica-Bold").fontSize(13).text(
    title,
    x + 110,
    y + 20,
    { width: width - 130, align: "center" }
  );

  doc.font("Helvetica").fontSize(9.5).text(
    subtitle,
    x + 110,
    y + 42,
    { width: width - 130, align: "center" }
  );

  doc.restore();
}

function addStyledPage(doc, meta) {
  if (doc.bufferedPageRange().count > 0) doc.addPage();
  drawHeader(doc, meta);
  drawFooter(doc, { text: "Campo do Gado – Manutenção Industrial – 2026" });
  doc.y = contentStartY(doc);
}

function ensureSpace(doc, neededHeight, meta) {
  if (doc.y + neededHeight <= contentEndY(doc)) return;
  addStyledPage(doc, meta);
}

function measureCellHeight(doc, text, width) {
  const value = text || "-";
  return doc.heightOfString(value, { width: width - (CELL_PADDING * 2), align: "left" }) + (CELL_PADDING * 2);
}

function drawTable(doc, {
  columns,
  rows,
  meta,
  emptyRow,
}) {
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const startX = PAGE.margin.left;

  const drawHeaderRow = () => {
    ensureSpace(doc, TABLE_HEADER_HEIGHT, meta);
    doc.save();
    doc.rect(startX, doc.y, tableWidth, TABLE_HEADER_HEIGHT).fill(COLORS.headerGreen);
    doc.font("Helvetica-Bold").fontSize(8.2).fillColor(COLORS.tableHeaderText);

    let x = startX;
    for (const column of columns) {
      doc.text(column.label, x + 4, doc.y + 7, {
        width: column.width - 8,
        align: "center",
      });
      x += column.width;
    }
    doc.restore();
    doc.y += TABLE_HEADER_HEIGHT;
  };

  const drawBodyRow = (row) => {
    doc.font("Helvetica").fontSize(8.8).fillColor(COLORS.text);

    const rowHeight = Math.max(
      ...columns.map((column) => measureCellHeight(doc, row[column.key], column.width))
    );

    ensureSpace(doc, rowHeight, meta);

    const rowTop = doc.y;
    doc.save();
    doc.rect(startX, rowTop, tableWidth, rowHeight).lineWidth(0.7).strokeColor(COLORS.border).stroke();

    let x = startX;
    for (const column of columns) {
      const text = row[column.key] || "-";
      doc.moveTo(x, rowTop).lineTo(x, rowTop + rowHeight).strokeColor(COLORS.border).stroke();
      doc.text(text, x + CELL_PADDING, rowTop + CELL_PADDING, {
        width: column.width - (CELL_PADDING * 2),
        align: column.align || "left",
      });
      x += column.width;
    }

    doc.moveTo(x, rowTop).lineTo(x, rowTop + rowHeight).strokeColor(COLORS.border).stroke();
    doc.restore();

    doc.y = rowTop + rowHeight;
  };

  drawHeaderRow();

  if (!rows.length) {
    drawBodyRow(emptyRow);
    return;
  }

  for (const row of rows) {
    drawBodyRow(row);
  }
}

function groupRoles(value) {
  if (!value) return "-";
  const partes = [];
  partes.push(value?.mecanico?.length ? `Mecânico: ${value.mecanico.join(", ")}` : "Mecânico: -");
  if (value?.auxiliar?.length) partes.push(`Auxiliar: ${value.auxiliar.join(", ")}`);
  if (value?.operacional?.length) partes.push(`Operacional: ${value.operacional.join(", ")}`);
  return partes.join("\n");
}

function normalizeApoio(item) {
  if (Array.isArray(item.apoioOperacionalDiurno)) {
    return { mecanico: [], auxiliar: [], operacional: item.apoioOperacionalDiurno };
  }

  if (item.apoioOperacionalDiurno && typeof item.apoioOperacionalDiurno === "object") {
    return item.apoioOperacionalDiurno;
  }

  if (item.apoio && typeof item.apoio === "object") {
    return item.apoio;
  }

  return { mecanico: [], auxiliar: [], operacional: item.diurno?.operacional || [] };
}

function generateWeeklyPDF(data = {}) {
  const doc = createDoc();
  const meta = {
    title: "ESCALA SEMANAL – MANUTENÇÃO INDUSTRIAL",
    subtitle: "Campo do Gado – Setor de Manutenção Industrial",
    logoPath: getLogoPath(),
  };

  process.nextTick(() => {
    addStyledPage(doc, meta);

    const rows = (data.rows || []).map((item) => ({
      semana: String(item.semanaNumero ?? item.semana ?? "-"),
      periodo: item.periodoTexto || item.periodo || "-",
      noturno: groupRoles(item.noturno),
      diurno: groupRoles(item.diurno),
      apoio: groupRoles(normalizeApoio(item)),
    }));

    drawTable(doc, {
      meta,
      columns: [
        { key: "semana", label: "Semana", width: 52, align: "center" },
        { key: "periodo", label: "Período (serviço)", width: 110, align: "center" },
        { key: "noturno", label: "Turno noturno (19h–05h)", width: 130 },
        { key: "diurno", label: "Turno diurno (07h–17h)", width: 130 },
        { key: "apoio", label: "Apoio operacional (diurno)", width: 127 },
      ],
      rows,
      emptyRow: {
        semana: "-",
        periodo: "-",
        noturno: "-",
        diurno: "Sem dados de escala semanal cadastrados.",
        apoio: "-",
      },
    });

    doc.end();
  });

  return doc;
}

function generatePeriodPDF(data = {}) {
  const doc = createDoc();
  const meta = {
    title: "ESCALA DE FOLGAS – COMPENSAÇÃO DE SERVIÇOS",
    subtitle: "Campo do Gado – Manutenção Industrial",
    logoPath: getLogoPath(),
  };

  process.nextTick(() => {
    addStyledPage(doc, meta);

    const start = data.start || "";
    const end = data.end || "";

    ensureSpace(doc, 18, meta);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text).text(
      `Período: ${formatDateBr(start)} até ${formatDateBr(end)}`,
      PAGE.margin.left,
      doc.y,
      { width: doc.page.width - PAGE.margin.left - PAGE.margin.right }
    );
    doc.y += 18;

    ensureSpace(doc, 20, meta);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.sectionTitle).text(
      "1. Base do serviço (registro de horas)",
      PAGE.margin.left,
      doc.y
    );
    doc.y += 16;

    const baseServicos = data.baseServicos || [];
    if (!baseServicos.length) {
      ensureSpace(doc, 16, meta);
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.text).text("Sem registros de serviço no período.", PAGE.margin.left, doc.y);
      doc.y += 16;
    } else {
      const limit = Math.min(baseServicos.length, 18);
      for (let i = 0; i < limit; i += 1) {
        const item = baseServicos[i];
        const line = `• ${formatDateBr(item.data)} — ${item.nome} (${item.turnoFuncao})`;
        ensureSpace(doc, 16, meta);
        doc.font("Helvetica").fontSize(9).fillColor(COLORS.text).text(line, PAGE.margin.left, doc.y, {
          width: doc.page.width - PAGE.margin.left - PAGE.margin.right,
        });
        doc.y += 14;
      }
    }

    doc.y += 8;
    ensureSpace(doc, 20, meta);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.sectionTitle).text(
      "2. Concessão das folgas",
      PAGE.margin.left,
      doc.y
    );
    doc.y += 16;

    const registros = data.registros || [];
    drawTable(doc, {
      meta,
      columns: [
        { key: "data", label: "Data", width: 88, align: "center" },
        { key: "tipo", label: "Tipo (Folga/Atestado)", width: 118, align: "center" },
        { key: "colaborador", label: "Colaborador", width: 170 },
        { key: "motivo", label: "Motivo (opcional)", width: 166 },
      ],
      rows: registros.map((row) => ({
        data: formatDateBr(row.data),
        tipo: row.tipo,
        colaborador: row.colaborador,
        motivo: row.motivo || "-",
      })),
      emptyRow: {
        data: "-",
        tipo: "-",
        colaborador: "Sem registros de folga/atestado no período.",
        motivo: "-",
      },
    });

    doc.end();
  });

  return doc;
}

module.exports = {
  formatDateBr,
  generateWeeklyPDF,
  generatePeriodPDF,
  drawHeader,
  drawFooter,
  drawTable,
  ensureSpace,
};
