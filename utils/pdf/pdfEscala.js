const PDFDocument = require("pdfkit");

function buildEscalaPdf(stream, { range, alocacoes }) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  doc.pipe(stream);

  // Cabeçalho
  doc.fontSize(16).text("Campo do Gado - Escala Semanal", { align: "left" });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#555").text(`Período: ${range.monday} até ${range.sunday}`);
  doc.moveDown(0.8);
  doc.fillColor("#000");

  // Agrupa por turno
  const grupos = { noturno: [], diurno: [], apoio: [], plantao: [], folga: [], outros: [] };
  for (const a of alocacoes) {
    const k = grupos[a.tipo_turno] ? a.tipo_turno : "outros";
    grupos[k].push(a);
  }

  function blocoTurno(titulo, items) {
    doc.fontSize(12).fillColor("#0f5132").text(titulo);
    doc.fillColor("#000");
    doc.moveDown(0.3);

    if (!items.length) {
      doc.fontSize(10).fillColor("#666").text("Sem registros.");
      doc.fillColor("#000");
      doc.moveDown(0.6);
      return;
    }

    // Tabela simples
    const startX = doc.x;
    const col1 = startX;
    const col2 = startX + 260;
    const col3 = startX + 380;

    doc.fontSize(10).text("Colaborador", col1);
    doc.text("Função", col2);
    doc.text("Horário", col3);
    doc.moveDown(0.2);
    doc.moveTo(startX, doc.y).lineTo(startX + 500, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.3);
    doc.strokeColor("#000");

    for (const it of items) {
      const horario =
        (it.horario_inicio && it.horario_fim)
          ? `${it.horario_inicio} - ${it.horario_fim}`
          : "-";

      doc.text(it.colaborador_nome || "-", col1);
      doc.text(it.colaborador_funcao || "-", col2);
      doc.text(horario, col3);
      if (it.observacao) {
        doc.fillColor("#666").fontSize(9).text(`Obs: ${it.observacao}`, col1, doc.y + 2);
        doc.fillColor("#000").fontSize(10);
      }
      doc.moveDown(0.6);
    }

    doc.moveDown(0.2);
  }

  blocoTurno("NOTURNO", grupos.noturno);
  blocoTurno("DIURNO", grupos.diurno);
  blocoTurno("APOIO OPERACIONAL", grupos.apoio);
  blocoTurno("PLANTÃO", grupos.plantao);

  // Rodapé
  doc.moveDown(1);
  doc.fontSize(9).fillColor("#777").text("Manutenção Campo do Gado - 2026", { align: "center" });

  doc.end();
}

module.exports = { buildEscalaPdf };
