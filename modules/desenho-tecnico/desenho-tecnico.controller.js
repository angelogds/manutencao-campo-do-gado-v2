const service = require('./desenho-tecnico.service');
const { validateDrawingInput } = require('./desenho-tecnico.validators');
const equipamentosService = require('../equipamentos/equipamentos.service');

function base(res, view, payload = {}) {
  return res.render(view, {
    title: payload.title || 'Desenho Técnico',
    activeMenu: 'desenho-tecnico',
    ...payload,
  });
}

function dashboard(req, res) {
  const desenhos = service.list({});
  const categorias = ['EIXOS', 'FLANGES', 'CHAPARIA', 'ESTRUTURAS', 'TRANSICOES'];
  const stats = {
    total: desenhos.length,
    modelos: service.listBiblioteca({}).length,
    pdfs: desenhos.reduce((acc, d) => acc + Number(d.total_pdfs || 0), 0),
  };
  const categoryCards = categorias.map((cat) => ({ nome: cat, total: desenhos.filter((d) => d.categoria === cat).length }));

  return base(res, 'desenho-tecnico/dashboard', {
    title: 'Desenho Técnico • Dashboard',
    desenhosRecentes: desenhos.slice(0, 8),
    stats,
    categoryCards,
  });
}

function index(req, res) {
  const filtros = {
    categoria: String(req.query.categoria || '').toUpperCase(),
    subtipo: String(req.query.subtipo || '').toUpperCase(),
    q: String(req.query.q || '').trim(),
  };
  return base(res, 'desenho-tecnico/index', {
    title: 'Desenho Técnico',
    lista: service.list(filtros),
    filtros,
  });
}

function novo(req, res) {
  return base(res, 'desenho-tecnico/form', {
    title: 'Novo Desenho Técnico',
    desenho: { revisao: 0, status: 'ATIVO' },
    equipamentos: equipamentosService.list(),
    mode: 'create',
    canManage: req.can && req.can('desenho_tecnico_manage'),
  });
}

function create(req, res) {
  const validation = validateDrawingInput(req.body);
  if (!validation.valid) {
    req.flash('error', validation.errors.join(' '));
    return res.redirect('/desenho-tecnico/novo');
  }

  const id = service.create({
    ...req.body,
    categoria: String(req.body.categoria || '').toUpperCase(),
    subtipo: String(req.body.subtipo || '').toUpperCase(),
    equipamento_id: req.body.equipamento_id || null,
    criado_por: req.session?.user?.id || null,
    props_json: JSON.stringify(validation.params),
  });

  const desenho = service.getById(id);
  service.saveSvgRevision(desenho, validation.params);

  req.flash('success', 'Desenho técnico criado com sucesso.');
  return res.redirect(`/desenho-tecnico/${id}`);
}

function show(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho) return res.status(404).render('errors/404', { title: 'Não encontrado' });
  return base(res, 'desenho-tecnico/show', {
    title: `${desenho.codigo} • Desenho Técnico`,
    desenho,
    revisoes: service.listRevisoes(desenho.id),
    svgPreview: service.generateSvg(desenho),
    canManage: req.can && req.can('desenho_tecnico_manage'),
  });
}

function edit(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho) return res.status(404).render('errors/404', { title: 'Não encontrado' });
  return base(res, 'desenho-tecnico/form', {
    title: `Editar ${desenho.codigo}`,
    desenho,
    equipamentos: equipamentosService.list(),
    mode: 'edit',
    canManage: req.can && req.can('desenho_tecnico_manage'),
  });
}

function update(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho) return res.status(404).render('errors/404', { title: 'Não encontrado' });
  const validation = validateDrawingInput(req.body);
  if (!validation.valid) {
    req.flash('error', validation.errors.join(' '));
    return res.redirect(`/desenho-tecnico/${req.params.id}/editar`);
  }

  const payload = {
    ...desenho,
    ...req.body,
    categoria: String(req.body.categoria || '').toUpperCase(),
    subtipo: String(req.body.subtipo || '').toUpperCase(),
    equipamento_id: req.body.equipamento_id || null,
    props_json: JSON.stringify(validation.params),
  };

  service.update(desenho.id, payload);
  const atualizado = service.getById(desenho.id);
  service.saveSvgRevision(atualizado, validation.params);
  req.flash('success', 'Desenho atualizado.');
  return res.redirect(`/desenho-tecnico/${desenho.id}`);
}

function remove(req, res) {
  service.inactivate(req.params.id);
  req.flash('success', 'Desenho inativado.');
  return res.redirect('/desenho-tecnico');
}

function duplicar(req, res) {
  const newId = service.duplicate(req.params.id, req.session?.user?.id || null);
  if (!newId) {
    req.flash('error', 'Desenho não encontrado para duplicação.');
    return res.redirect('/desenho-tecnico');
  }
  req.flash('success', 'Desenho duplicado.');
  return res.redirect(`/desenho-tecnico/${newId}/editar`);
}

async function gerarPdf(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho) return res.status(404).render('errors/404', { title: 'Não encontrado' });

  try {
    const info = await service.generatePdf(desenho, desenho.props_json);
    req.flash('success', 'PDF técnico gerado.');
    return res.redirect(info.relPath);
  } catch (e) {
    req.flash('error', `Falha ao gerar PDF: ${e.message || e}`);
    return res.redirect(`/desenho-tecnico/${desenho.id}`);
  }
}

function gerarSvg(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho) return res.status(404).json({ error: 'Não encontrado' });
  const svg = service.generateSvg(desenho, desenho.props_json);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  return res.send(svg);
}

function vincularEquipamento(req, res) {
  service.vincularEquipamento(req.params.id, req.body.equipamento_id, req.body.posicao_aplicacao, req.body.observacao);
  req.flash('success', 'Desenho vinculado ao equipamento.');
  return res.redirect(`/desenho-tecnico/${req.params.id}`);
}

function biblioteca(req, res) {
  const filtros = {
    categoria: String(req.query.categoria || '').toUpperCase(),
    subtipo: String(req.query.subtipo || '').toUpperCase(),
    q: String(req.query.q || '').trim(),
  };
  return base(res, 'desenho-tecnico/biblioteca', {
    title: 'Biblioteca Técnica',
    filtros,
    itens: service.listBiblioteca(filtros),
  });
}

function revisoes(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho) return res.status(404).render('errors/404', { title: 'Não encontrado' });
  return base(res, 'desenho-tecnico/preview', {
    title: `Revisões ${desenho.codigo}`,
    desenho,
    revisoes: service.listRevisoes(desenho.id),
  });
}

module.exports = {
  dashboard,
  index,
  novo,
  create,
  show,
  edit,
  update,
  remove,
  duplicar,
  gerarPdf,
  gerarSvg,
  vincularEquipamento,
  biblioteca,
  revisoes,
};
