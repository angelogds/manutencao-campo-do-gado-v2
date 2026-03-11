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
      v.forEach((item) => lines.push(`  • ${JSON.stringify(item)}`));
    } else {
      lines.push(`- ${k}: ${v}`);
    }
  });
  return lines;
}

function gerarPdf(req, res) {
  const tracagem = service.getById(req.params.id);
  if (!tracagem) return res.status(404).render('errors/404', { title: 'Não encontrado' });

  const filename = `tracagem_${tracagem.tipo}_${tracagem.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.fontSize(20).text('Manutenção Campo do Gado', { align: 'center' });
  doc.fontSize(16).text('Relatório Técnico de Traçagem', { align: 'center' });
  doc.moveDown(0.8);
  doc.fontSize(12).text(`Título do cálculo: ${tracagem.titulo || '-'}`);
  doc.text(`Tipo: ${LABELS[tracagem.tipo] || tracagem.tipo}`);
  doc.text(`Data: ${tracagem.created_at || '-'}`);
  doc.text(`Usuário responsável: ${tracagem.usuario_nome || '-'}`);
  doc.text(`Unidade utilizada: ${tracagem.parametros?.unidade || 'mm'}`);
  doc.text(`OS vinculada: ${tracagem.os_id || '-'}`);
  doc.text(`Equipamento vinculado: ${tracagem.equipamento_nome || '-'}`);
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
    doc.moveDown();
  }

  doc.fontSize(12).text('Observações técnicas', { underline: true });
  (tracagem.resultado?.observacoes || ['Conferir folga, solda, sentido de montagem e espessura da chapa antes do corte final.'])
    .forEach((o) => doc.fontSize(10).text(`- ${o}`));

  doc.moveDown();
  doc.rect(doc.x, doc.y, 420, 120).stroke();
  doc.text('Bloco visual de planificação (reserva para desenho técnico / QR Code / assinatura).', doc.x + 10, doc.y + 10, { width: 380 });
  doc.moveDown(6);
  doc.fontSize(10).text('Conferir folga, solda, sentido de montagem e espessura da chapa antes do corte final.');
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
