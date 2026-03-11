const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const service = require('./tracagem.service');

function getPdfDocumentClass() {
  try {
    // Lazy-load para não derrubar o módulo /tracagem inteiro caso falte dependência de PDF.
    // eslint-disable-next-line global-require
    return require('pdfkit');
  } catch (_err) {
    return null;
  }
}

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
  muted: '#475569',
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

const IGNORE_PARAM_FIELDS = new Set(['unidade', 'unidadeEntrada', 'unidadeInterna']);

const PARAM_DESCRIPTIONS = {
  D: 'Diâmetro externo',
  d: 'Diâmetro interno / tubo base',
  P: 'Passo',
  E: 'Espessura da chapa',
  h: 'Altura útil',
  H: 'Altura útil',
  R: 'Raio de curvatura',
  A: 'Ângulo',
  G: 'Quantidade de gomos',
  N: 'Número de divisões',
  folgaSolda: 'Folga para solda',
  voltas: 'Quantidade de voltas',
  PCD: 'Diâmetro primitivo (PCD)',
  anguloInicial: 'Ângulo inicial',
  diametroFuro: 'Diâmetro do furo',
  D1: 'Diâmetro maior',
  D2: 'Diâmetro menor',
  C: 'Comprimento auxiliar',
  alpha: 'Ângulo de inclinação',
};

const PLAN_LEGENDS = {
  R1_dev: 'R1 = raio maior da planificação',
  R2_dev: 'R2 = raio menor da planificação',
  T: 'T = largura / altura útil',
  C: 'C = comprimento desenvolvido',
  C1: 'C1 = comprimento desenvolvido',
  angulo_dev: 'Ângulo = abertura da planificação',
  angulo_setor: 'Ângulo = abertura da planificação',
  A: 'A = comprimento desenvolvido',
  B: 'B = largura / altura útil',
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

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function formatValue(value, unit = '', forceUnit = false) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${formatNumber(value)}${forceUnit || unit ? ` ${unit}` : ''}`.trim();
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return `${formatNumber(Number(value))}${forceUnit || unit ? ` ${unit}` : ''}`.trim();
  }
  return String(value);
}

function buildFormattedData(tracagem) {
  const unidade = tracagem.parametros?.unidade || tracagem.resultado?.entrada?.unidadeEntrada || 'mm';
  const entrada = tracagem.resultado?.entrada || {};
  const resultado = tracagem.resultado?.resultado || {};
  const labels = tracagem.resultado?.planificacao?.labels || {};

  const identificacao = [
    { campo: 'Tipo', valor: LABELS[tracagem.tipo] || tracagem.tipo || '-' },
    { campo: 'Data', valor: formatDate(tracagem.created_at) },
    { campo: 'Usuário', valor: tracagem.usuario_nome || '-' },
    { campo: 'Unidade', valor: unidade },
    { campo: 'OS', valor: tracagem.os_id || '-' },
    { campo: 'Equipamento', valor: tracagem.equipamento_nome || '-' },
    { campo: 'Código', valor: tracagem.id || '-' },
  ];

  const parametrosFormatados = Object.entries(entrada)
    .filter(([key, value]) => !IGNORE_PARAM_FIELDS.has(key) && value !== null && value !== undefined)
    .map(([key, value]) => {
      const isNumeric = typeof value === 'number' || (typeof value === 'string' && !Number.isNaN(Number(value)));
      return {
        parametro: key,
        descricao: PARAM_DESCRIPTIONS[key] || key,
        valor: formatValue(value, isNumeric ? unidade : ''),
      };
    });

  const resultadosFormatados = [];
  [['R1', resultado.R1_dev], ['R1', resultado.R1], ['R2', resultado.R2_dev], ['R2', resultado.R2], ['T', resultado.T], ['C', resultado.C], ['C1', resultado.C1], ['Ângulo', resultado.angulo_dev], ['Ângulo', resultado.angulo_setor], ['A', resultado.A], ['B', resultado.B]].forEach(([label, value]) => {
    if (value === null || value === undefined) return;
    resultadosFormatados.push({
      medida: label,
      legenda: PLAN_LEGENDS[`${label === 'Ângulo' ? 'angulo_dev' : label}`] || PLAN_LEGENDS[label] || label,
      valor: label === 'Ângulo' ? `${formatNumber(Number(value))}°` : formatValue(value, unidade),
    });
  });

  Object.entries(labels).forEach(([key, value]) => {
    if (['pontos', 'linhas', 'divisoes'].includes(key)) return;
    const medida = key.toUpperCase().includes('ANGULO') ? 'Ângulo' : key.replace('_dev', '').replace('_setor', '').toUpperCase();
    const labelExists = resultadosFormatados.some((item) => item.legenda === (PLAN_LEGENDS[key] || key));
    if (labelExists || value === null || value === undefined || Number.isNaN(Number(value))) return;
    resultadosFormatados.push({
      medida,
      legenda: PLAN_LEGENDS[key] || key,
      valor: medida === 'Ângulo' ? `${formatNumber(Number(value))}°` : formatValue(value, unidade),
    });
  });

  const observacoesFormatadas = Array.isArray(tracagem.resultado?.observacoes)
    ? tracagem.resultado.observacoes.filter((item) => item && String(item).trim() !== '').map((item) => String(item).trim())
    : [];

  if (!observacoesFormatadas.length) {
    observacoesFormatadas.push('Conferir folga, solda, sentido de montagem e espessura da chapa antes do corte final.');
  }

  return {
    identificacao,
    parametrosFormatados,
    resultadosFormatados,
    planificacaoFormatada: resultadosFormatados,
    observacoesFormatadas,
    imagensDaPeca: resolveImagePath(tracagem.tipo, 'peca'),
    imagensDaPlanificacao: resolveImagePath(tracagem.tipo, 'planificacao'),
    unidade,
  };
}

function drawSimpleTable(doc, x, y, width, rows, headers) {
  const rowHeight = 20;
  const colWidths = headers.map((h) => h.width);

  doc.fillColor(PDF_STYLE.green).rect(x, y, width, rowHeight).fill();
  let currentX = x;
  headers.forEach((header, index) => {
    doc.fillColor('#ffffff').fontSize(9).text(header.label, currentX + 6, y + 6, { width: colWidths[index] - 12 });
    currentX += colWidths[index];
  });

  let currentY = y + rowHeight;
  rows.forEach((row, idx) => {
    const bg = idx % 2 === 0 ? '#ffffff' : PDF_STYLE.light;
    doc.fillColor(bg).rect(x, currentY, width, rowHeight).fill();
    doc.strokeColor(PDF_STYLE.border).rect(x, currentY, width, rowHeight).stroke();

    currentX = x;
    headers.forEach((header, index) => {
      doc.fillColor(PDF_STYLE.text).fontSize(9).text(row[header.key] || '-', currentX + 6, currentY + 6, { width: colWidths[index] - 12 });
      currentX += colWidths[index];
    });
    currentY += rowHeight;
  });

  return currentY;
}

function drawHeader(doc, tracagem, dados) {
  const width = doc.page.width - 80;
  doc.roundedRect(40, 30, width, 105, 10).fillAndStroke(PDF_STYLE.green, PDF_STYLE.green);

  const logo = path.join(process.cwd(), 'public', 'IMG', 'logopdf_campo_do_gado.png.png');
  if (fs.existsSync(logo)) {
    doc.image(logo, 50, 48, { fit: [80, 35] });
  }

  doc.fillColor('#ffffff').fontSize(15).text('MANUTENÇÃO CAMPO DO GADO', 145, 46);
  doc.fontSize(10).text('RELATÓRIO TÉCNICO DE TRAÇAGEM', 145, 66);

  const info = dados.identificacao;
  doc.fontSize(9)
    .text(`Tipo: ${info[0].valor}`, 380, 45, { width: 190, align: 'right' })
    .text(`Data: ${info[1].valor}`, 380, 59, { width: 190, align: 'right' })
    .text(`Usuário: ${info[2].valor}`, 380, 73, { width: 190, align: 'right' })
    .text(`Unidade: ${info[3].valor}`, 380, 87, { width: 190, align: 'right' });

  doc.fillColor(PDF_STYLE.text);
  doc.y = 150;
}

function drawIdentification(doc, dados) {
  ensurePageSpace(doc, 120);
  drawSectionTitle(doc, 'Identificação');
  const rows = dados.identificacao.map((item) => ({ campo: item.campo, valor: item.valor }));
  doc.y = drawSimpleTable(doc, 40, doc.y + 6, 530, rows, [
    { label: 'Campo', key: 'campo', width: 200 },
    { label: 'Valor', key: 'valor', width: 330 },
  ]) + 8;
}

function drawParametros(doc, dados) {
  ensurePageSpace(doc, 140);
  drawSectionTitle(doc, 'Parâmetros informados');
  const rows = dados.parametrosFormatados.length ? dados.parametrosFormatados : [{ parametro: '-', descricao: 'Sem parâmetros disponíveis', valor: '-' }];
  doc.y = drawSimpleTable(doc, 40, doc.y + 6, 530, rows, [
    { label: 'Parâmetro', key: 'parametro', width: 100 },
    { label: 'Descrição', key: 'descricao', width: 250 },
    { label: 'Valor', key: 'valor', width: 180 },
  ]) + 8;
}

function drawTwoColumnSection(doc, title, leftTitle, rightTitle, leftImage, rightRows, rightHeaders) {
  ensurePageSpace(doc, 250);
  drawSectionTitle(doc, title);
  const startY = doc.y + 8;
  const leftX = 40;
  const rightX = 312;
  const colWidth = 258;

  doc.fillColor('#ffffff').roundedRect(leftX, startY, colWidth, 200, 8).fillAndStroke('#ffffff', PDF_STYLE.border);
  doc.fillColor(PDF_STYLE.green).fontSize(10).text(leftTitle, leftX, startY + 8, { width: colWidth, align: 'center' });
  if (leftImage && fs.existsSync(leftImage)) {
    doc.image(leftImage, leftX + 8, startY + 24, { fit: [colWidth - 16, 168], align: 'center', valign: 'center' });
  } else {
    doc.fillColor(PDF_STYLE.muted).fontSize(9).text('Imagem não disponível', leftX, startY + 92, { width: colWidth, align: 'center' });
  }

  doc.fillColor('#ffffff').roundedRect(rightX, startY, colWidth, 200, 8).fillAndStroke('#ffffff', PDF_STYLE.border);
  doc.fillColor(PDF_STYLE.green).fontSize(10).text(rightTitle, rightX, startY + 8, { width: colWidth, align: 'center' });
  const rows = rightRows.length ? rightRows : [{ [rightHeaders[0].key]: '-', [rightHeaders[1].key]: '-', [rightHeaders[2].key]: '-' }];
  drawSimpleTable(doc, rightX + 6, startY + 28, colWidth - 12, rows.slice(0, 7), rightHeaders.map((header) => ({ ...header, width: Math.floor((colWidth - 12) * header.weight) })));

  doc.fillColor(PDF_STYLE.text);
  doc.y = startY + 210;
}

function drawObservacoes(doc, dados) {
  ensurePageSpace(doc, 120);
  drawSectionTitle(doc, 'Observações técnicas');
  doc.moveDown(0.3);
  dados.observacoesFormatadas.forEach((obs) => {
    doc.fontSize(10).fillColor(PDF_STYLE.text).text(`• ${obs}`);
  });
  doc.moveDown(0.5);
}

function drawFooter(doc) {
  const y = doc.page.height - 30;
  doc.fontSize(8).fillColor(PDF_STYLE.muted).text('Sistema de Manutenção Campo do Gado • Setor de Manutenção', 40, y, {
    width: doc.page.width - 80,
    align: 'center',
  });
}

function renderPdfReport(res, tracagem, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const PdfDocumentClass = getPdfDocumentClass();
  if (!PdfDocumentClass) {
    res.status(503).send('PDF temporariamente indisponível. Verifique a dependência pdfkit no servidor.');
    return;
  }

  const dados = buildFormattedData(tracagem);
  const doc = new PdfDocumentClass({ margin: 40 });
  doc.pipe(res);

  drawHeader(doc, tracagem, dados);
  drawIdentification(doc, dados);
  drawParametros(doc, dados);

  drawTwoColumnSection(
    doc,
    'Peça + parâmetros',
    'Imagem da peça',
    'Parâmetros informados',
    dados.imagensDaPeca,
    dados.parametrosFormatados.map((item) => ({ p: item.parametro, d: item.descricao, v: item.valor })),
    [
      { label: 'Parâmetro', key: 'p', weight: 0.25 },
      { label: 'Descrição', key: 'd', weight: 0.45 },
      { label: 'Valor', key: 'v', weight: 0.3 },
    ],
  );

  drawTwoColumnSection(
    doc,
    'Planificação + medidas',
    'Imagem da planificação',
    'Medidas da planificação',
    dados.imagensDaPlanificacao,
    dados.planificacaoFormatada.map((item) => ({ m: item.medida, l: item.legenda, v: item.valor })),
    [
      { label: 'Medida', key: 'm', weight: 0.22 },
      { label: 'Legenda', key: 'l', weight: 0.48 },
      { label: 'Valor', key: 'v', weight: 0.3 },
    ],
  );

  drawObservacoes(doc, dados);
  drawFooter(doc);
  doc.end();
}

function gerarPdf(req, res) {
  const tracagem = service.getById(req.params.id);
  if (!tracagem) return res.status(404).render('errors/404', { title: 'Não encontrado' });

  const filename = `tracagem_${tracagem.tipo}_${tracagem.id}.pdf`;
  return renderPdfReport(res, tracagem, filename);
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
    return renderPdfReport(res, tracagem, filename);
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
