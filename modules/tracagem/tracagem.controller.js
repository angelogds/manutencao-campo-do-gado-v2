const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const service = require('./tracagem.service');

const LABELS = {
  'rosca-helicoidal': 'Rosca helicoidal',
  'furacao-flange': 'Furação de flange',
  cilindro: 'Cilindro',
  'curva-gomos': 'Curva de gomos',
  'quadrado-para-redondo': 'Quadrado para redondo',
  'reducao-concentrica': 'Redução concêntrica',
  'semi-cilindro': 'Semi-cilindro',
  'boca-de-lobo-excentrica': 'Boca de lobo excêntrica',
  'boca-lobo-excentrica': 'Boca de lobo excêntrica',
  'boca-de-lobo-45': 'Boca de lobo (ângulo variável)',
  'boca-de-lobo-90': 'Boca de lobo 90 graus',
  'boca-lobo-45': 'Boca de lobo (ângulo variável)',
  'boca-lobo-90': 'Boca de lobo 90 graus',
  'boca-de-lobo-45-graus': 'Boca de lobo (ângulo variável)',
  'boca-de-lobo-90-graus': 'Boca de lobo 90 graus',
  'mao-francesa': 'Mão francesa',
  'pao-francesa': 'Mão francesa',
};

const PDF_STYLE = {
  green: '#1f9d55',
  light: '#f4fbf7',
  border: '#cde8d6',
  text: '#0f172a',
};

const IMAGE_ALIAS = {
  'boca-lobo-excentrica': 'boca-de-lobo-excentrica',
  'boca-lobo-45': 'boca-de-lobo-45',
  'boca-lobo-90': 'boca-de-lobo-90',
  'boca-de-lobo-45-graus': 'boca-de-lobo-45',
  'boca-de-lobo-90-graus': 'boca-de-lobo-90',
  'quadrado-redondo': 'quadrado-para-redondo',
  'pao-francesa': 'mao-francesa',
};

function baseRender(req, res, view, payload = {}) {
  return res.render(view, {
    title: payload.title || 'Traçagem',
    activeMenu: 'tracagem',
    ...payload,
  });
}

function index(req, res) {
  return baseRender(req, res, 'tracagem/index', { title: 'Traçagem' });
}

function lista(req, res) {
  const filtros = {
    tipo: req.query.tipo || '',
    equipamento_id: req.query.equipamento_id || '',
    os_id: req.query.os_id || '',
    periodo_inicio: req.query.periodo_inicio || '',
    periodo_fim: req.query.periodo_fim || '',
  };

  const tracagens = service.list(filtros);
  return baseRender(req, res, 'tracagem/lista', {
    title: 'Histórico de traçagem',
    filtros,
    tracagens,
    equipamentos: service.listEquipamentos(),
    ordensServico: service.listOSAbertas(),
    labels: LABELS,
  });
}

function show(req, res) {
  const tracagem = service.getById(req.params.id);
  if (!tracagem) return res.status(404).render('errors/404', { title: 'Não encontrado' });

  return baseRender(req, res, 'tracagem/show', {
    title: `Traçagem #${tracagem.id}`,
    tracagem,
    labels: LABELS,
  });
}

function renderCalc(tipo, viewName, title) {
  return (req, res) => baseRender(req, res, `tracagem/${viewName}`, {
    title,
    tipo,
    labels: LABELS,
    equipamentos: service.listEquipamentos(),
    ordensServico: service.listOSAbertas(),
    calculo: null,
  });
}

function calcular(tipo, viewName, title) {
  return (req, res) => {
    try {
      const resultado = service.calcularPorTipo(tipo, req.body);
      return baseRender(req, res, `tracagem/${viewName}`, {
        title,
        tipo,
        labels: LABELS,
        equipamentos: service.listEquipamentos(),
        ordensServico: service.listOSAbertas(),
        calculo: {
          parametros: req.body,
          resultado,
        },
      });
    } catch (err) {
      req.flash('error', err.message || 'Erro ao calcular traçagem.');
      return res.redirect(`/tracagem/${tipo}`);
    }
  };
}

function salvar(req, res) {
  try {
    const tipo = req.body.tipo;
    const parametros = JSON.parse(req.body.parametros_json || '{}');
    const resultado = JSON.parse(req.body.resultado_json || '{}');

    const id = service.salvar({
      tipo,
      titulo: req.body.titulo,
      equipamento_id: req.body.equipamento_id ? Number(req.body.equipamento_id) : null,
      os_id: req.body.os_id ? Number(req.body.os_id) : null,
      usuario_id: req.session?.user?.id || null,
      parametros,
      resultado,
    });

    req.flash('success', `Traçagem #${id} salva com sucesso.`);
    return res.redirect(`/tracagem/${id}`);
  } catch (err) {
    req.flash('error', err.message || 'Erro ao salvar traçagem.');
    return res.redirect('/tracagem');
  }
}

function jsonToLines(title, obj = {}) {
  const lines = [title];
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      lines.push(`- ${k}:`);
      v.slice(0, 25).forEach((item) => lines.push(`  • ${JSON.stringify(item)}`));
    } else if (typeof v === 'object' && v !== null) {
      lines.push(`- ${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`- ${k}: ${v}`);
    }
  });
  return lines;
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-BR');
}

function resolveTipo(tipo) {
  return IMAGE_ALIAS[tipo] || tipo;
}

function resolveImagePath(tipo, sufixo) {
  const base = resolveTipo(tipo);
  const candidates = [
    path.join(process.cwd(), 'public', 'img', 'tracagem', 'planificacoes', `${base}-${sufixo}.png`),
    path.join(process.cwd(), 'public', 'img', 'tracagem', 'planificacoes', `${base}-${sufixo}.png.JPG`),
    path.join(process.cwd(), 'public', 'img', 'tracagem', 'planificacoes', `${base}-${sufixo}.JPG`),
    path.join(process.cwd(), 'public', 'img', 'tracagem', 'planificacoes', `${base}-${sufixo}.jpg`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function drawSectionTitle(doc, title) {
  doc.moveDown(0.2);
  doc.fillColor(PDF_STYLE.green).fontSize(12).text(title, { underline: true });
  doc.fillColor(PDF_STYLE.text);
}

function ensurePageSpace(doc, needed = 120) {
  if (doc.y + needed > doc.page.height - 50) doc.addPage();
}

function drawImages(doc, tipo) {
  const peca = resolveImagePath(tipo, 'peca');
  const plan = resolveImagePath(tipo, 'planificacao');

  if (!peca && !plan) return;
  ensurePageSpace(doc, 280);
  drawSectionTitle(doc, 'Peça e planificação');
  doc.moveDown(0.4);

  const startY = doc.y;
  const boxW = 245;
  const boxH = 180;

  if (peca) {
    doc.fillColor('#ffffff').roundedRect(40, startY, boxW, boxH, 8).fillAndStroke('#ffffff', PDF_STYLE.border);
    doc.image(peca, 46, startY + 22, { fit: [boxW - 12, boxH - 30], align: 'center', valign: 'center' });
    doc.fillColor(PDF_STYLE.green).fontSize(9).text('Peça', 40, startY + 6, { width: boxW, align: 'center' });
  }

  if (plan) {
    const x = 305;
    doc.fillColor('#ffffff').roundedRect(x, startY, boxW, boxH, 8).fillAndStroke('#ffffff', PDF_STYLE.border);
    doc.image(plan, x + 6, startY + 22, { fit: [boxW - 12, boxH - 30], align: 'center', valign: 'center' });
    doc.fillColor(PDF_STYLE.green).fontSize(9).text('Planificação', x, startY + 6, { width: boxW, align: 'center' });
  }

  doc.fillColor(PDF_STYLE.text);
  doc.y = startY + boxH + 12;
}

function drawHeader(doc, tracagem) {
  const width = doc.page.width - 80;
  doc.roundedRect(40, 30, width, 90, 10).fillAndStroke(PDF_STYLE.green, PDF_STYLE.green);

  const logo = path.join(process.cwd(), 'public', 'IMG', 'logopdf_campo_do_gado.png.png');
  if (fs.existsSync(logo)) {
    doc.image(logo, 52, 46, { fit: [70, 30] });
  }

  doc.fillColor('#ffffff').fontSize(15).text('Manutenção Campo do Gado', 130, 45);
  doc.fontSize(10).text('Relatório Técnico de Traçagem', 130, 64);

  doc.fillColor('#ffffff').fontSize(10)
    .text(`Tipo: ${LABELS[tracagem.tipo] || tracagem.tipo || '-'}`, 400, 45, { width: 180, align: 'right' })
    .text(`Data: ${formatDate(tracagem.created_at)}`, 400, 60, { width: 180, align: 'right' });

  doc.fillColor(PDF_STYLE.text);
  doc.y = 140;
}

function drawMetadata(doc, tracagem) {
  drawSectionTitle(doc, 'Identificação');
  const cardsY = doc.y + 6;
  const cardW = 265;

  doc.roundedRect(40, cardsY, cardW, 74, 8).fillAndStroke(PDF_STYLE.light, PDF_STYLE.border);
  doc.roundedRect(315, cardsY, cardW, 74, 8).fillAndStroke(PDF_STYLE.light, PDF_STYLE.border);

  doc.fillColor(PDF_STYLE.text).fontSize(10)
    .text(`Título: ${tracagem.titulo || '-'}`, 50, cardsY + 10, { width: cardW - 18 })
    .text(`Usuário: ${tracagem.usuario_nome || '-'}`, 50, cardsY + 28, { width: cardW - 18 })
    .text(`Unidade: ${tracagem.parametros?.unidade || 'mm'}`, 50, cardsY + 46, { width: cardW - 18 })
    .text(`OS: ${tracagem.os_id || '-'}`, 325, cardsY + 10, { width: cardW - 18 })
    .text(`Equipamento: ${tracagem.equipamento_nome || '-'}`, 325, cardsY + 28, { width: cardW - 18 })
    .text(`Código: ${tracagem.id || '-'}`, 325, cardsY + 46, { width: cardW - 18 });

  doc.y = cardsY + 85;
}

function drawDataSection(doc, title, data) {
  ensurePageSpace(doc, 140);
  drawSectionTitle(doc, title);
  doc.moveDown(0.2);
  jsonToLines('', data).slice(1).forEach((line) => doc.fontSize(9.5).text(line));
}

function drawDivisoesTable(doc, tracagem) {
  const divs = tracagem.resultado?.planificacao?.divisoes || [];
  if (!Array.isArray(divs) || !divs.length) return;

  ensurePageSpace(doc, 180);
  drawSectionTitle(doc, 'Tabela de pontos/divisões');
  doc.moveDown(0.2);
  divs.slice(0, 30).forEach((d, index) => {
    doc.fontSize(9.2).text(`${index + 1}. ${JSON.stringify(d)}`);
  });
}

function renderPdfReport(res, tracagem, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  drawHeader(doc, tracagem);
  drawMetadata(doc, tracagem);
  drawDataSection(doc, 'Parâmetros informados', tracagem.parametros || {});
  drawDataSection(doc, 'Resultados calculados', tracagem.resultado || {});
  drawDivisoesTable(doc, tracagem);
  drawImages(doc, tracagem.tipo);

  const observacoes = tracagem.resultado?.observacoes || ['Conferir folga, solda, sentido de montagem e espessura da chapa antes do corte final.'];
  drawDataSection(doc, 'Observações técnicas', { observacoes });

  doc.end();
}

function gerarPdfCalculo(req, res) {
  try {
    const tipo = req.body.tipo;
    const parametros = JSON.parse(req.body.parametros_json || '{}');
    const resultado = JSON.parse(req.body.resultado_json || '{}');
    const tracagem = {
      id: 'calculo',
      tipo,
      titulo: req.body.titulo || `Cálculo de ${LABELS[tipo] || tipo || 'traçagem'}`,
      created_at: new Date().toISOString(),
      usuario_nome: req.session?.user?.name || req.session?.user?.username || '-',
      parametros,
      resultado,
      os_id: req.body.os_id || '-',
      equipamento_nome: req.body.equipamento_nome || '-',
    };

    const filename = `tracagem_${tracagem.tipo || 'calculo'}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(20).text('Manutenção Campo do Gado', { align: 'center' });
    doc.fontSize(16).text('Relatório Técnico de Traçagem', { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(12).text(`Título do cálculo: ${tracagem.titulo || '-'}`);
    doc.text(`Tipo: ${LABELS[tracagem.tipo] || tracagem.tipo || '-'}`);
    doc.text(`Data: ${tracagem.created_at || '-'}`);
    doc.text(`Usuário responsável: ${tracagem.usuario_nome || '-'}`);
    doc.text(`Unidade utilizada: ${tracagem.parametros?.unidade || 'mm'}`);
    doc.moveDown();

    doc.fontSize(13).text('Parâmetros informados', { underline: true });
    jsonToLines('', tracagem.parametros).slice(1).forEach((line) => doc.fontSize(11).text(line));
    doc.moveDown();
    doc.fontSize(13).text('Resultados calculados', { underline: true });
    jsonToLines('', tracagem.resultado).slice(1).forEach((line) => doc.fontSize(11).text(line));
    doc.moveDown();

    const divs = tracagem.resultado?.planificacao?.divisoes || [];
    if (Array.isArray(divs) && divs.length) {
      doc.fontSize(13).text('Tabela de pontos/divisões', { underline: true });
      divs.slice(0, 20).forEach((d) => doc.fontSize(10).text(`• ${JSON.stringify(d)}`));
    }

    doc.end();
  } catch (err) {
    req.flash('error', err.message || 'Erro ao gerar PDF.');
    return res.redirect('back');
  }
}

module.exports = {
  index,
  lista,
  show,
  roscaForm: renderCalc('rosca-helicoidal', 'rosca-helicoidal', 'Rosca helicoidal'),
  roscaCalcular: calcular('rosca-helicoidal', 'rosca-helicoidal', 'Rosca helicoidal'),
  flangeForm: renderCalc('furacao-flange', 'furacao-flange', 'Furação de flange'),
  flangeCalcular: calcular('furacao-flange', 'furacao-flange', 'Furação de flange'),
  cilindroForm: renderCalc('cilindro', 'cilindro', 'Cilindro'),
  cilindroCalcular: calcular('cilindro', 'cilindro', 'Cilindro'),
  curvaForm: renderCalc('curva-gomos', 'curva-gomos', 'Curva de gomos'),
  curvaCalcular: calcular('curva-gomos', 'curva-gomos', 'Curva de gomos'),
  quadradoRedondoForm: renderCalc('quadrado-para-redondo', 'quadrado-redondo', 'Quadrado para redondo'),
  quadradoRedondoCalcular: calcular('quadrado-para-redondo', 'quadrado-redondo', 'Quadrado para redondo'),
  reducaoConcentricaForm: renderCalc('reducao-concentrica', 'reducao-concentrica', 'Redução concêntrica'),
  reducaoConcentricaCalcular: calcular('reducao-concentrica', 'reducao-concentrica', 'Redução concêntrica'),
  semiCilindroForm: renderCalc('semi-cilindro', 'semi-cilindro', 'Semi-cilíndro'),
  semiCilindroCalcular: calcular('semi-cilindro', 'semi-cilindro', 'Semi-cilíndro'),
  bocaLoboExcentricaForm: renderCalc('boca-de-lobo-excentrica', 'boca-lobo-excentrica', 'Boca de lobo excêntrica'),
  bocaLoboExcentricaCalcular: calcular('boca-de-lobo-excentrica', 'boca-lobo-excentrica', 'Boca de lobo excêntrica'),
  bocaLobo45Form: renderCalc('boca-de-lobo-45', 'boca-lobo-45', 'Boca de lobo (ângulo variável)'),
  bocaLobo45Calcular: calcular('boca-de-lobo-45', 'boca-lobo-45', 'Boca de lobo (ângulo variável)'),
  bocaLobo90Form: renderCalc('boca-de-lobo-90', 'boca-lobo-90', 'Boca de lobo 90 graus'),
  bocaLobo90Calcular: calcular('boca-de-lobo-90', 'boca-lobo-90', 'Boca de lobo 90 graus'),
  maoFrancesaForm: renderCalc('mao-francesa', 'mao-francesa', 'Mão francesa'),
  maoFrancesaCalcular: calcular('mao-francesa', 'mao-francesa', 'Mão francesa'),
  salvar,
  gerarPdf,
  gerarPdfCalculo,
};
