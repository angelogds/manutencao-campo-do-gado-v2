const PDFDocument = require("pdfkit");

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(";") || s.includes("\n") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCSV({ equipamentos, matrix, ncList }) {
  const lines = ["GRADE", ["Equipamento", ...Array.from({ length: 31 }, (_, i) => i + 1)].join(";")];
  equipamentos.forEach((eq) => lines.push([csvEscape(eq.nome), ...(matrix.get(eq.nome) || []).map((c) => c.status || "-")].join(";")));

  lines.push("", "NAO_CONFORMIDADES");
  lines.push("Item;Data;Nao Conformidade;Acao Corretiva;Acao Preventiva;Data Correcao;OS;Data Inicio OS;Data Fim OS;Causa");
  ncList.forEach((nc) => lines.push([
    csvEscape(nc.equipamento_nome), csvEscape(nc.data_ocorrencia), csvEscape(nc.nao_conformidade), csvEscape(nc.acao_corretiva),
    csvEscape(nc.acao_preventiva), csvEscape(nc.data_correcao), csvEscape(nc.os_id), csvEscape(nc.os_data_inicio), csvEscape(nc.os_data_fim), csvEscape(nc.causa_parada),
  ].join(";")));

  return `${lines.join("\n")}\n`;
}

function drawHeader(doc, inspecao) {
  const x = 24;
  const y = 24;
  doc.rect(x, y, 547, 22).stroke("#111");
  doc.rect(x, y, 110, 22).stroke("#111");
  doc.rect(x + 110, y, 377, 22).stroke("#111");
  doc.rect(x + 487, y, 42, 22).stroke("#111");
  doc.rect(x + 529, y, 42, 22).stroke("#111");

  doc.fontSize(8).text("CAMPO DO GADO", x + 10, y + 7);
  doc.fontSize(7).text("PROGRAMA DE AUTO CONTROLE\nPAC 01 - MANUTENÇÃO", x + 120, y + 4, { width: 360, align: "center" });
  doc.fontSize(7).text("PAC. 01", x + 491, y + 7, { width: 34, align: "center" });
  doc.fontSize(7).text("OG. 02", x + 533, y + 7, { width: 34, align: "center" });

  doc.rect(x, y + 22, 547, 18).stroke("#111");
  doc.rect(x, y + 22, 182, 18).stroke("#111");
  doc.rect(x + 182, y + 22, 182, 18).stroke("#111");
  doc.rect(x + 364, y + 22, 183, 18).stroke("#111");

  doc.fontSize(7).text(`Monitor: ${inspecao.monitor_nome || "-"}`, x + 4, y + 28);
  doc.text(`Verificador: ${inspecao.verificador_nome || "-"}`, x + 186, y + 28);
  doc.text(`Frequência: ${inspecao.frequencia || "Diária"} | Mês/Ano: ${String(inspecao.mes).padStart(2, "0")}/${inspecao.ano}`, x + 368, y + 28);
}

function statusColor(s) {
  if (s === "NC") return "#b91c1c";
  if (s === "EA") return "#92400e";
  if (s === "SP") return "#374151";
  return "#166534";
}

function drawGrade(doc, equipamentos, matrix, diasMes) {
  let y = 70;
  const x = 24;
  const nameW = 130;
  const dayW = 13.4;

  doc.rect(x, y, 547, 18).stroke("#111");
  doc.rect(x, y, nameW, 18).stroke("#111");
  doc.fontSize(7).text("EQUIPAMENTO", x + 3, y + 6);
  doc.fontSize(7).text("DIAS", x + nameW + 190, y + 3);

  y += 18;
  doc.rect(x, y, 547, 12).stroke("#111");
  doc.rect(x, y, nameW, 12).stroke("#111");
  for (let d = 1; d <= 31; d += 1) {
    const dx = x + nameW + (d - 1) * dayW;
    doc.rect(dx, y, dayW, 12).stroke("#111");
    doc.fontSize(6).fillColor("#111").text(String(d), dx + 3.5, y + 3);
  }

  y += 12;
  equipamentos.forEach((eq, idx) => {
    if (y > 760) {
      doc.addPage();
      drawHeader(doc, { ...{ monitor_nome: "", verificador_nome: "", frequencia: "Diária", mes: "", ano: "" } });
      y = 70;
    }

    doc.rect(x, y, 547, 12).stroke("#999");
    doc.rect(x, y, nameW, 12).stroke("#999");
    doc.fontSize(6).fillColor("#111").text(`${idx + 1}- ${eq.nome}`, x + 2, y + 3, { width: nameW - 4, ellipsis: true });

    const row = matrix.get(eq.nome) || [];
    for (let d = 1; d <= 31; d += 1) {
      const dx = x + nameW + (d - 1) * dayW;
      doc.rect(dx, y, dayW, 12).stroke("#999");
      const st = d > diasMes ? "-" : (row[d - 1]?.status || "C");
      doc.fontSize(6).fillColor(st === "-" ? "#9ca3af" : statusColor(st)).text(st, dx + 2.8, y + 3);
    }
    y += 12;
  });

  doc.fontSize(7).fillColor("#111").text("LEGENDA - C: Conforme · NC: Não Conforme · EA: Em Andamento · SP: Sem Produção", x, y + 6);
  return y + 18;
}

function drawNC(doc, ncList, yStart) {
  let y = yStart;
  const x = 24;
  const widths = [85, 38, 135, 130, 120, 39];
  const headers = ["Item", "Data", "Não Conformidade", "Ação corretiva", "Ação preventiva", "Correção"];

  if (y > 700) {
    doc.addPage();
    y = 40;
  }

  let cx = x;
  headers.forEach((h, i) => {
    doc.rect(cx, y, widths[i], 14).stroke("#111");
    doc.fontSize(7).fillColor("#111").text(h, cx + 2, y + 4, { width: widths[i] - 4, align: "center" });
    cx += widths[i];
  });
  y += 14;

  (ncList.length ? ncList : [{}]).forEach((nc) => {
    if (y > 770) {
      doc.addPage();
      y = 40;
    }
    const vals = [
      nc.equipamento_nome || "",
      nc.data_ocorrencia || "",
      nc.nao_conformidade || "",
      nc.acao_corretiva || "",
      nc.acao_preventiva || "",
      nc.data_correcao || "",
    ];

    let xx = x;
    vals.forEach((v, i) => {
      doc.rect(xx, y, widths[i], 20).stroke("#999");
      doc.fontSize(6).fillColor("#111").text(String(v), xx + 2, y + 3, { width: widths[i] - 4, height: 18, ellipsis: true });
      xx += widths[i];
    });
    y += 20;
  });
}

function renderPDF({ res, inspecao, equipamentos, matrix, ncList, diasMes }) {
  const doc = new PDFDocument({ size: "A4", margin: 18 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=inspecao-pac01-${inspecao.ano}-${String(inspecao.mes).padStart(2, "0")}.pdf`);
  doc.pipe(res);

  drawHeader(doc, inspecao);
  const yAfterGrade = drawGrade(doc, equipamentos, matrix, diasMes);
  drawNC(doc, ncList, yAfterGrade);

  doc.end();
}

module.exports = { buildCSV, renderPDF };
