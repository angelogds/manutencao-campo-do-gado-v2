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
    cad: desenhos.filter((d) => d.tipo_origem === 'cad').length,
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
    tipo_origem: String(req.query.tipo_origem || '').toLowerCase(),
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
    desenho: { revisao: 0, status: 'ATIVO', tipo_origem: 'parametrico' },
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
    tipo_origem: 'parametrico',
    equipamento_id: req.body.equipamento_id || null,
    criado_por: req.session?.user?.id || null,
    props_json: JSON.stringify(validation.params),
  });

  const desenho = service.getById(id);
  service.saveSvgRevision(desenho, validation.params);

  req.flash('success', 'Desenho técnico criado com sucesso.');
  return res.redirect(`/desenho-tecnico/${id}`);
}

function novoCad(req, res) {
  return base(res, 'desenho-tecnico/cad-form', {
    title: 'Novo Desenho CAD',
    desenho: { revisao: 0, status: 'ATIVO', tipo_origem: 'cad' },
    equipamentos: equipamentosService.list(),
    mode: 'create',
    canManage: req.can && req.can('desenho_tecnico_manage'),
  });
}

function createCad(req, res) {
  const codigo = String(req.body.codigo || '').trim();
  const titulo = String(req.body.titulo || '').trim();
  if (!codigo || !titulo) {
    req.flash('error', 'Código e título são obrigatórios para desenho CAD.');
    return res.redirect('/desenho-tecnico/cad/novo');
  }

  const id = service.create({
    ...req.body,
    codigo,
    titulo,
    categoria: String(req.body.categoria || 'CHAPARIA').toUpperCase(),
    subtipo: String(req.body.subtipo || 'BASE_SIMPLES').toUpperCase(),
    equipamento_id: req.body.equipamento_id || null,
    tipo_origem: 'cad',
    modo_cad_ativo: 1,
    json_cad: JSON.stringify({
      codigo,
      titulo,
      gridStep: 25,
      snapEnabled: true,
      activeLayer: 'geometria_principal',
      layers: service.CAD_LAYERS.reduce((acc, name, idx) => ({ ...acc, [name]: { color: ['#0f172a', '#0ea5e9', '#16a34a', '#7c3aed', '#dc2626', '#64748b', '#ea580c'][idx] || '#0f172a', visible: true, locked: false } }), {}),
      objects: [],
      history: [],
    }),
    criado_por: req.session?.user?.id || null,
  });

  req.flash('success', 'Desenho CAD criado.');
  return res.redirect(`/desenho-tecnico/cad/${id}/editor`);
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

function showCad(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho || desenho.tipo_origem !== 'cad') return res.status(404).render('errors/404', { title: 'CAD não encontrado' });
  return base(res, 'desenho-tecnico/cad-show', {
    title: `${desenho.codigo} • CAD`,
    desenho,
    revisoes: service.listRevisoes(desenho.id),
    canManage: req.can && req.can('desenho_tecnico_manage'),
    svgPreview: service.generateSvg(desenho),
  });
}

function cadEditor(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho || desenho.tipo_origem !== 'cad') return res.status(404).render('errors/404', { title: 'CAD não encontrado' });
  return base(res, 'desenho-tecnico/cad-editor', {
    title: `${desenho.codigo} • Editor CAD`,
    desenho,
    layers: service.CAD_LAYERS,
    cadData: desenho.cad_data || { objects: [] },
    canManage: req.can && req.can('desenho_tecnico_manage'),
  });
}

function saveCad(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho || desenho.tipo_origem !== 'cad') return res.status(404).json({ ok: false, error: 'CAD não encontrado' });

  try {
    const result = service.saveCad(desenho.id, req.body.cad_json || req.body, req.session?.user?.id || null);
    return res.json({ ok: true, ...result });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || String(e) });
  }
}

function renderCad3d(req, res) {
  const desenho = service.getById(req.params.id);
  if (!desenho || desenho.tipo_origem !== 'cad') return res.status(404).json({ ok: false, error: 'CAD não encontrado' });

  const cadPayload = desenho.cad_data || {};
  if (!service.isCad3dCompatible(cadPayload)) {
    return res.status(422).json({ ok: false, error: 'Desenho CAD sem geometria compatível com extrusão simples.' });
  }
  return res.json({ ok: true, preview3d: service.build3dFromCad(cadPayload) });
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


function adicionarCamada(req, res) {
  try {
    service.createCamada(req.params.id, String(req.body.nome || '').trim());
    req.flash('success', 'Camada criada.');
  } catch (e) {
    req.flash('error', e.message || 'Falha ao criar camada.');
  }
  return res.redirect(`/desenho-tecnico/${req.params.id}`);
}

function atualizarCamada(req, res) {
  try {
    service.toggleCamada(req.params.id, req.params.camadaId, req.body.action);
    req.flash('success', 'Camada atualizada.');
  } catch (e) {
    req.flash('error', e.message || 'Falha ao atualizar camada.');
  }
  return res.redirect(`/desenho-tecnico/${req.params.id}`);
}

function inserirBloco(req, res) {
  try {
    service.inserirBloco(req.params.id, req.body);
    req.flash('success', 'Bloco inserido no desenho.');
  } catch (e) {
    req.flash('error', e.message || 'Falha ao inserir bloco.');
  }
  return res.redirect(`/desenho-tecnico/${req.params.id}`);
}

function adicionarCota(req, res) {
  try {
    service.salvarCota(req.params.id, req.body);
    req.flash('success', 'Cota adicionada.');
  } catch (e) {
    req.flash('error', e.message || 'Falha ao salvar cota.');
  }
  return res.redirect(`/desenho-tecnico/${req.params.id}`);
}

function duplicarBloco(req, res) {
  const id = service.duplicateBloco(req.params.blocoId);
  if (!id) req.flash('error', 'Bloco não encontrado.');
  else req.flash('success', 'Bloco duplicado.');
  return res.redirect('/desenho-tecnico/biblioteca');
}

function integrarTracagem(req, res) {
  try {
    const desenho = service.integrarTracagem(req.params.origem, req.params.id, req.session?.user?.id || null);
    service.saveSvgRevision(desenho);
    req.flash('success', 'Desenho técnico gerado a partir da Traçagem.');
    return res.redirect(`/desenho-tecnico/${desenho.id}`);
  } catch (e) {
    req.flash('error', e.message || 'Integração com Traçagem falhou.');
    return res.redirect('/tracagem/lista');
  }
}

module.exports = {
  dashboard,
  index,
  novo,
  create,
  novoCad,
  createCad,
  show,
  showCad,
  cadEditor,
  saveCad,
  renderCad3d,
  edit,
  update,
  remove,
  duplicar,
  gerarPdf,
  gerarSvg,
  vincularEquipamento,
  biblioteca,
  revisoes,
  adicionarCamada,
  atualizarCamada,
  inserirBloco,
  adicionarCota,
  duplicarBloco,
  integrarTracagem,
};
