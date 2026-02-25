const PDFDocument = require("pdfkit");

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(";") || s.includes("\n") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCSV({ equipamentos, matrix, ncList }) {
  const lines = [];
  lines.push("GRADE");
  lines.push(["Equipamento", ...Array.from({ length: 31 }, (_, i) => i + 1)].join(";"));

  for (const eq of equipamentos) {
    const row = matrix.get(eq.id) || [];
    const statuses = row.map((c) => c.status || "-");
    lines.push([csvEscape(eq.nome), ...statuses].join(";"));
  }

  lines.push("");
  lines.push("NAO_CONFORMIDADES");
  lines.push("Item;Data;Nao Conformidade;Acao Corretiva;Acao Preventiva;Data Correcao;OS ID");

  for (const nc of ncList) {
    lines.push([
      csvEscape(nc.item),
      csvEscape(nc.data_ocorrencia),
      csvEscape(nc.nao_conformidade),
      csvEscape(nc.acao_corretiva),
      csvEscape(nc.acao_preventiva),
      csvEscape(nc.data_correcao),
      csvEscape(nc.os_id),
    ].join(";"));
  }

  return `${lines.join("\n")}\n`;
}

function drawHeader(doc, inspecao) {
  doc.rect(32, 24, 531, 46).fill("#16A34A");
  doc.fillColor("#fff").fontSize(16).text("PAC 01 – MANUTENÇÃO", 44, 34);
  doc.fontSize(10).text("Campo do Gado", 44, 52);

  doc.fillColor("#111827").fontSize(9);
  doc.text(`Mês/Ano: ${String(inspecao.mes).padStart(2, "0")}/${inspecao.ano}`, 32, 78);
  doc.text(`Frequência: ${inspecao.frequencia || "Diária"}`, 180, 78);
  doc.text(`Monitor: ${inspecao.monitor_nome || "-"}`, 32, 92);
  doc.text(`Verificador: ${inspecao.verificador_nome || "-"}`, 180, 92);
}

function drawFooter(doc) {
  const y = doc.page.height - 22;
  doc.fontSize(8).fillColor("#4b5563").text("Campo do Gado • Sistema de Manutenção", 32, y);
  doc.text(`Página ${doc.bufferedPageRange().count}`, 500, y, { width: 60, align: "right" });
}

function renderPDF({ res, inspecao, equipamentos, matrix, ncList, diasMes }) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 24, bufferPages: true });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=inspecao-pac01-${inspecao.ano}-${String(inspecao.mes).padStart(2, "0")}.pdf`
  );

  doc.pipe(res);

  drawHeader(doc, inspecao);
  doc.moveDown(2.8);

  const left = 24;
  const equipCol = 160;
  const dayCol = 18;
  const headerY = 126;

  doc.fontSize(8).fillColor("#111827").text("Equipamento", left + 2, headerY + 3, { width: equipCol - 4 });
  for (let d = 1; d <= 31; d += 1) {
    const x = left + equipCol + (d - 1) * dayCol;
    doc.rect(x, headerY, dayCol, 16).stroke("#d1d5db");
    doc.text(String(d), x, headerY + 4, { width: dayCol, align: "center" });
  }

  let y = headerY + 16;
  for (const eq of equipamentos) {
    if (y > 530) {
      doc.addPage();
      drawHeader(doc, inspecao);
      y = 126;
    }

    doc.rect(left, y, equipCol, 16).stroke("#e5e7eb");
    doc.fontSize(7).fillColor("#111827").text(eq.nome, left + 3, y + 4, { width: equipCol - 6, ellipsis: true });

    const row = matrix.get(eq.id) || [];
    for (let d = 1; d <= 31; d += 1) {
      const x = left + equipCol + (d - 1) * dayCol;
      doc.rect(x, y, dayCol, 16).stroke("#e5e7eb");
      const status = d > diasMes ? "-" : (row[d - 1]?.status || "C");
      let color = "#166534";
      if (status === "NC") color = "#b91c1c";
      if (status === "EA") color = "#92400e";
      if (status === "SP") color = "#374151";
      if (status === "-") color = "#9ca3af";
      doc.fillColor(color).fontSize(7).text(status, x, y + 4, { width: dayCol, align: "center" });
    }

    y += 16;
  }

  doc.addPage({ layout: "portrait" });
  drawHeader(doc, inspecao);
  doc.fontSize(11).fillColor("#166534").text("Não Conformidades", 32, 126);

  const columns = [50, 70, 170, 120, 120, 70, 40];
  const headers = ["Item", "Data", "Não Conformidade", "Ação corretiva", "Ação preventiva", "Correção", "OS"];

  let yNc = 144;
  let x = 32;
  doc.fontSize(8).fillColor("#111827");
  headers.forEach((h, i) => {
    doc.rect(x, yNc, columns[i], 16).stroke("#d1d5db");
    doc.text(h, x + 2, yNc + 4, { width: columns[i] - 4 });
    x += columns[i];
  });

  yNc += 16;
  for (const nc of ncList) {
    const row = [
      nc.item,
      nc.data_ocorrencia,
      nc.nao_conformidade,
      nc.acao_corretiva || "-",
      nc.acao_preventiva || "-",
      nc.data_correcao || "-",
      nc.os_id || "-",
    ];

    const rowHeight = 30;
    if (yNc > 780) {
      doc.addPage();
      drawHeader(doc, inspecao);
      yNc = 126;
    }

    let xx = 32;
    row.forEach((value, idx) => {
      doc.rect(xx, yNc, columns[idx], rowHeight).stroke("#e5e7eb");
      doc.fontSize(7).fillColor("#111827").text(String(value), xx + 2, yNc + 4, {
        width: columns[idx] - 4,
        height: rowHeight - 6,
        ellipsis: true,
      });
      xx += columns[idx];
    });

    yNc += rowHeight;
  }

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(i);
    drawFooter(doc);
  }

  doc.end();
}

module.exports = { buildCSV, renderPDF };
