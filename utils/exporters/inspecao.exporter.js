const PDFDocument = require("pdfkit");

function statusColor(status) {
  if (status === "NC") return "#b91c1c";
  if (status === "EA") return "#a16207";
  if (status === "SP") return "#374151";
  return "#166534";
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(";") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCSV({ equipamentos, matrix, ncList }) {
  const lines = [];
  lines.push("GRADE");
  lines.push(["Equipamento", ...Array.from({ length: 31 }, (_, i) => i + 1)].join(";"));

  for (const eq of equipamentos) {
    const row = matrix.get(eq.nome) || [];
    const statuses = row.map((c) => c.status || "-");
    lines.push([csvEscape(eq.nome), ...statuses].join(";"));
  }

  lines.push("");
  lines.push("NAO_CONFORMIDADES");
  lines.push("Item;Data;Nao Conformidade;Acao Corretiva;Acao Preventiva;Data Correcao;OS;Data Inicio OS;Data Fim OS;Causa");

  for (const nc of ncList) {
    lines.push([
      csvEscape(nc.equipamento_nome),
      csvEscape(nc.data_ocorrencia),
      csvEscape(nc.nao_conformidade),
      csvEscape(nc.acao_corretiva),
      csvEscape(nc.acao_preventiva),
      csvEscape(nc.data_correcao),
      csvEscape(nc.os_id),
      csvEscape(nc.os_data_inicio),
      csvEscape(nc.os_data_fim),
      csvEscape(nc.causa_parada),
    ].join(";"));
  }

  return `${lines.join("\n")}\n`;
}

function renderPDF({ res, inspecao, equipamentos, matrix, ncList, diasMes }) {
  const doc = new PDFDocument({ size: "A4", margin: 32 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=inspecao-pac01-${inspecao.ano}-${String(inspecao.mes).padStart(2, "0")}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(15).fillColor("#166534").text("Campo do Gado — PAC 01 Manutenção", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#111827").text("Inspeção Mensal", { align: "center" });
  doc.moveDown();

  doc.fontSize(9);
  doc.text(`Mês/Ano: ${String(inspecao.mes).padStart(2, "0")}/${inspecao.ano}`);
  doc.text(`Frequência: ${inspecao.frequencia || "Diária"}`);
  doc.text(`Monitor: ${inspecao.monitor_nome || "-"}`);
  doc.text(`Verificador: ${inspecao.verificador_nome || "-"}`);
  doc.moveDown();

  doc.fontSize(10).fillColor("#166534").text("Grade mensal");
  doc.moveDown(0.3);

  const startY = doc.y;
  const colEquip = 145;
  const colW = 12;

  doc.fontSize(6).fillColor("#111827").text("Equipamento", 32, startY, { width: colEquip });
  for (let d = 1; d <= 31; d += 1) {
    doc.text(String(d), 32 + colEquip + (d - 1) * colW, startY, { width: colW, align: "center" });
  }

  let y = startY + 10;
  for (const eq of equipamentos) {
    if (y > 760) {
      doc.addPage();
      y = 40;
    }

    doc.fontSize(6).fillColor("#111827").text(eq.nome, 32, y, { width: colEquip, ellipsis: true });
    const row = matrix.get(eq.nome) || [];

    for (let d = 1; d <= 31; d += 1) {
      const cell = row[d - 1] || { status: "-" };
      const status = d > diasMes ? "-" : cell.status;
      doc.fillColor(statusColor(status)).text(status, 32 + colEquip + (d - 1) * colW, y, { width: colW, align: "center" });
    }

    y += 11;
  }

  doc.addPage();
  doc.fontSize(11).fillColor("#166534").text("Não Conformidades");
  doc.moveDown(0.5);

  const headers = ["Item", "Data", "Não conformidade", "Ação corretiva", "Ação preventiva", "Correção", "OS"];
  const widths = [80, 52, 120, 100, 100, 45, 28];
  let x = 32;
  const yHeader = doc.y;

  doc.fontSize(8).fillColor("#111827");
  headers.forEach((h, idx) => {
    doc.text(h, x, yHeader, { width: widths[idx] });
    x += widths[idx];
  });

  let yNc = yHeader + 14;
  for (const nc of ncList) {
    if (yNc > 760) {
      doc.addPage();
      yNc = 40;
    }

    const rowValues = [
      nc.equipamento_nome,
      nc.data_ocorrencia,
      nc.nao_conformidade,
      nc.acao_corretiva || "-",
      nc.acao_preventiva || "-",
      nc.data_correcao || "-",
      nc.os_id || "-",
    ];

    let xx = 32;
    rowValues.forEach((val, idx) => {
      doc.fontSize(7).fillColor("#111827").text(String(val), xx, yNc, { width: widths[idx], height: 24, ellipsis: true });
      xx += widths[idx];
    });

    yNc += 24;
  }

  doc.end();
}

module.exports = { buildCSV, renderPDF };
