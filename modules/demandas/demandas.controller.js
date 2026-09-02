const service = require('./demandas.service');
const { normalizeRole, canAccessModule } = require('../../config/rbac');

function parseItens(body) {
  const toArray = (value) => Array.isArray(value) ? value : (value === undefined || value === null || value === '' ? [] : [value]);
  const nomes = toArray(body.itens_nome ?? body['itens_nome[]'] ?? body.item_nome);
  const especificacoes = toArray(body.itens_especificacao ?? body['itens_especificacao[]'] ?? body.item_descricao);
  const unidades = toArray(body.itens_un ?? body['itens_un[]'] ?? body.unidade);
  const quantidades = toArray(body.itens_qtd ?? body['itens_qtd[]'] ?? body.qtd_solicitada);
  const itemIds = toArray(body.itens_item_id ?? body['itens_item_id[]'] ?? body.estoque_item_id);
  const tamanho = Math.max(nomes.length, especificacoes.length, unidades.length, quantidades.length, itemIds.length);
  return Array.from({ length: tamanho }, (_, i) => ({
    item_nome: String(nomes[i] || '').trim(),
    item_descricao: String(especificacoes[i] || '').trim(),
    unidade: String(unidades[i] || 'UN').trim() || 'UN',
    qtd_solicitada: Number(quantidades[i] || 0),
    estoque_item_id: itemIds[i] ? Number(itemIds[i]) : null,
  })).filter((item) => item.item_nome && item.qtd_solicitada > 0);
}

function index(req, res) {
  const filters = {
    status: String(req.query.status || '').trim().toUpperCase(),
    prioridade: String(req.query.prioridade || '').trim().toUpperCase(),
    responsavel_user_id: req.query.responsavel_user_id || '',
    query: String(req.query.q || '').trim(),
  };
  const lista = service.list(filters, req.session?.user);
  return res.render('demandas/index', {
    title: 'Demandas', activeMenu: 'demandas', lista, filters,
    statusList: service.STATUS,
    responsaveis: service.listResponsaveis(),
    counters: service.getCounters(req.session?.user),
  });
}

function newForm(req, res) {
  return res.render('demandas/new', {
    title: 'Nova Demanda', activeMenu: 'demandas',
    categorias: service.CATEGORIAS,
    equipamentos: service.listEquipamentos(),
    demandasPai: service.listDemandasPai(),
  });
}

function create(req, res) {
  try {
    const role = normalizeRole(req.session?.user?.role);
    const categoria = String(req.body.categoria || 'MANUTENCAO').toUpperCase();
    if (role === 'RH' && !['NR','SEGURANCA','AUDITORIA'].includes(categoria)) {
      throw new Error('O perfil RH pode abrir demandas apenas de NR, Segurança ou Auditoria.');
    }
    const id = service.create({ ...req.body, categoria, created_by: req.session?.user?.id });
    req.flash('success', `Demanda #${id} criada.`);
    return res.redirect(`/demandas/${id}`);
  } catch (e) {
    req.flash('error', e.message || 'Erro ao criar demanda.');
    return res.redirect('/demandas/new');
  }
}

function show(req, res) {
  const id = Number(req.params.id);
  const demanda = service.getById(id);
  if (!demanda) return res.status(404).render('errors/404', { title: 'Não encontrado' });

  const visiveis = service.list({}, req.session?.user);
  if (!visiveis.some((d) => Number(d.id) === id)) {
    req.flash('error', 'Você não tem permissão para ver esta demanda.');
    return res.redirect('/demandas');
  }

  const role = normalizeRole(req.session?.user?.role);
  return res.render('demandas/view', {
    title: `Demanda #${id}`, activeMenu: 'demandas', demanda,
    responsaveis: service.listResponsaveis(),
    equipamentos: service.listEquipamentos(),
    demandasPai: service.listDemandasPai(id),
    statusList: service.STATUS,
    aprovacaoList: service.APROVACAO_STATUS,
    categorias: service.CATEGORIAS,
    estoqueItens: require('../solicitacoes/solicitacoes.service').listEstoqueItens(),
    canManage: canAccessModule(role, 'demandas_manage'),
    canMaterials: canAccessModule(role, 'demandas_materials'),
    isCompras: role === 'COMPRAS',
  });
}

function updateStatus(req, res) {
  const id = Number(req.params.id);
  try {
    service.updateStatus(id, {
      status: req.body.status,
      responsavel_user_id: req.body.responsavel_user_id,
      aprovacao_status: req.body.aprovacao_status,
      user_id: req.session?.user?.id || null,
    });
    req.flash('success', 'Situação da demanda atualizada.');
  } catch (e) { req.flash('error', e.message || 'Erro ao atualizar status.'); }
  return res.redirect(`/demandas/${id}`);
}

function addUpdate(req, res) {
  const id = Number(req.params.id);
  try {
    service.addUpdate(id, req.body.texto, req.session?.user?.id || null);
    req.flash('success', 'Atualização registrada.');
  } catch (e) { req.flash('error', e.message || 'Erro ao salvar atualização.'); }
  return res.redirect(`/demandas/${id}`);
}

function createSubdemanda(req, res) {
  const id = Number(req.params.id);
  try {
    const parent = service.getById(id);
    if (!parent) throw new Error('Demanda principal não encontrada.');
    const childId = service.create({
      ...req.body,
      demanda_pai_id: id,
      equipamento_id: req.body.equipamento_id || parent.equipamento_id,
      categoria: req.body.categoria || parent.categoria,
      setor_origem: req.body.setor_origem || parent.setor_origem,
      created_by: req.session?.user?.id,
    });
    req.flash('success', `Subdemanda #${childId} adicionada.`);
  } catch (e) { req.flash('error', e.message || 'Erro ao criar subdemanda.'); }
  return res.redirect(`/demandas/${id}`);
}

function createMaterials(req, res) {
  const id = Number(req.params.id);
  try {
    const itens = parseItens(req.body);
    const solicitacaoId = service.createMaterialSolicitacao(id, {
      userId: req.session?.user?.id,
      titulo: req.body.titulo,
      descricao: req.body.descricao,
      prioridade: req.body.prioridade,
      itens,
    });
    req.flash('success', `Planejamento de materiais criado. Solicitação #${solicitacaoId} enviada para pré-cotação em Compras.`);
  } catch (e) { req.flash('error', e.message || 'Erro ao criar planejamento de materiais.'); }
  return res.redirect(`/demandas/${id}`);
}

function convertToOS(req, res) {
  const id = Number(req.params.id);
  try {
    const osId = service.convertToOS(id, req.session?.user?.id || null);
    req.flash('success', `Demanda vinculada à OS #${osId}. Os materiais planejados foram preservados e vinculados à OS.`);
    return res.redirect(`/os/${osId}`);
  } catch (e) {
    req.flash('error', e.message || 'Erro ao converter demanda.');
    return res.redirect(`/demandas/${id}`);
  }
}

module.exports = { index, newForm, create, show, updateStatus, addUpdate, createSubdemanda, createMaterials, convertToOS };
