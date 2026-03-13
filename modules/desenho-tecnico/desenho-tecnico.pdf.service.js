const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const PDF_DIR = path.join(process.env.UPLOADS_DIR || (fs.existsSync('/data') ? '/data/uploads' : path.join(process.cwd(), 'uploads')), 'desenho-tecnico-pdf');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

function generateTechnicalPdf(desenho, svgMarkup) {
  const filename = `${String(desenho.codigo || 'desenho').replace(/[^a-zA-Z0-9_-]+/g, '-')}-rev${desenho.revisao || 0}.pdf`;
  const fullPath = path.join(PDF_DIR, filename);
  const relPath = `/uploads/desenho-tecnico-pdf/${filename}`;

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);

  doc.fontSize(18).fillColor('#166534').text('Campo do Gado - Desenho Técnico', { align: 'left' });
  doc.moveDown(0.4);
  doc.fontSize(11).fillColor('#111827');
  doc.text(`Código: ${desenho.codigo}`);
  doc.text(`Título: ${desenho.titulo}`);
  doc.text(`Revisão: ${desenho.revisao}`);
  doc.text(`Categoria/Subtipo: ${desenho.categoria} / ${desenho.subtipo}`);
  doc.text(`Material: ${desenho.material || '-'}`);
  doc.text(`Equipamento vinculado: ${desenho.equipamento_nome || '-'}`);
  doc.text(`Responsável: ${desenho.criado_por_nome || '-'}`);
  doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`);
  doc.moveDown(0.6);
  doc.fontSize(9).fillColor('#334155').text('Prévia SVG serializada para rastreabilidade técnica:');
  doc.fontSize(7).fillColor('#475569').text((svgMarkup || '').slice(0, 5000) || 'Sem SVG');
  doc.moveDown(0.8);
  doc.fontSize(10).fillColor('#111827').text(`Observações: ${desenho.observacoes || '-'}`);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve({ fullPath, relPath, filename }));
    stream.on('error', reject);
  });
}

module.exports = { generateTechnicalPdf };
