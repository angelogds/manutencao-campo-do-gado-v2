const db = require('../../database/db');
const { normalizeRole } = require('../../config/rbac');
const solicitacoesService = require('../solicitacoes/solicitacoes.service');

const STATUS = ['NOVA','EM_ANALISE','PLANEJAMENTO','AGUARDANDO_APROVACAO','APROVADA','EM_ANDAMENTO','PARADA','CONCLUIDA','CANCELADA'];
const CATEGORIAS = ['MANUTENCAO','PRODUCAO','SEGURANCA','NR','AUDITORIA','MELHORIA','PROJETO','DIRETORIA'];
const APROVACAO_STATUS = ['NAO_SUBMETIDA','AGUARDANDO','APROVADA','REPROVADA'];

function tableExists(name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}
function hasColumn(table, name) {
  try { return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === name); } catch { return false; }
}
function canViewAll(role) {
  return ['ADMIN','DIRETORIA','ENCARREGADO_PRODUCAO','ENCARREGADO_MANUTENCAO','MANUTENCAO_SUPERVISOR'].includes(normalizeRole(role));
}

function list(filters = {}, user) {
  const role = normalizeRole(user?.role);
  const where = ['1=1'];
  const params = {};
  if (filters.status && STATUS.includes(String(filters.status).toUpperCase())) { where.push('d.status = @status'); params.status = String(filters.status).toUpperCase(); }
  if (filters.prioridade) { where.push('d.prioridade = @prioridade'); params.prioridade = String(filters.prioridade).toUpperCase(); }
  if (filters.responsavel_user_id) { where.push('d.responsavel_user_id = @responsavel_user_id'); params.responsavel_user_id = Number(filters.responsavel_user_id); }
  if (filters.query) {
    where.push("(LOWER(d.titulo) LIKE @query OR LOWER(COALESCE(d.descricao,'')) LIKE @query OR CAST(d.id AS TEXT) LIKE @query)");
    params.query = `%${String(filters.query).trim().toLowerCase()}%`;
  }
  if (!canViewAll(role)) {
    if (role === 'RH') where.push("d.categoria IN ('NR','SEGURANCA','AUDITORIA')");
    else if (role === 'COMPRAS') where.push('EXISTS (SELECT 1 FROM solicitacoes s WHERE s.demanda_id = d.id)');
    else { where.push('(d.created_by = @uid OR d.responsavel_user_id = @uid)'); params.uid = Number(user?.id || 0); }
  }

  return db.prepare(`
    SELECT d.*, u.name AS created_by_nome, r.name AS responsavel_nome,
           e.nome AS equipamento_nome, p.titulo AS demanda_pai_titulo,
           (SELECT COUNT(*) FROM demandas f WHERE f.demanda_pai_id=d.id) AS subdemandas_count,
           (SELECT COUNT(*) FROM solicitacoes s WHERE s.demanda_id=d.id) AS solicitacoes_count,
           (SELECT COUNT(*) FROM os o WHERE o.demanda_id=d.id) AS os_count
    FROM demandas d
    LEFT JOIN users u ON u.id=d.created_by
    LEFT JOIN users r ON r.id=d.responsavel_user_id
    LEFT JOIN equipamentos e ON e.id=d.equipamento_id
    LEFT JOIN demandas p ON p.id=d.demanda_pai_id
    WHERE ${where.join(' AND ')}
    ORDER BY CASE d.prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'NORMAL' THEN 3 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 ELSE 5 END,
             datetime(COALESCE(d.updated_at,d.created_at)) DESC, d.id DESC
  `).all(params);
}

function getById(id) {
  const demanda = db.prepare(`
    SELECT d.*, u.name AS created_by_nome, r.name AS responsavel_nome, e.nome AS equipamento_nome, p.titulo AS demanda_pai_titulo
    FROM demandas d
    LEFT JOIN users u ON u.id=d.created_by
    LEFT JOIN users r ON r.id=d.responsavel_user_id
    LEFT JOIN equipamentos e ON e.id=d.equipamento_id
    LEFT JOIN demandas p ON p.id=d.demanda_pai_id
    WHERE d.id=?
  `).get(id);
  if (!demanda) return null;

  const logs = db.prepare(`SELECT l.*,u.name AS user_nome FROM demanda_logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.demanda_id=? ORDER BY l.id DESC`).all(id);
  const subdemandas = db.prepare(`
    SELECT d.*,u.name AS responsavel_nome FROM demandas d LEFT JOIN users u ON u.id=d.responsavel_user_id
    WHERE d.demanda_pai_id=? ORDER BY CASE d.prioridade WHEN 'URGENTE' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'NORMAL' THEN 3 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 ELSE 5 END,d.id
  `).all(id);

  let solicitacoes = [];
  if (tableExists('solicitacoes')) {
    const cotacoesSelect = tableExists('compras_cotacoes')
      ? ", (SELECT COUNT(*) FROM compras_cotacoes c WHERE c.solicitacao_id=s.id) AS cotacoes_count, (SELECT COALESCE(MIN(NULLIF(c.valor_total,0)),0) FROM compras_cotacoes c WHERE c.solicitacao_id=s.id) AS menor_cotacao"
      : ', 0 AS cotacoes_count, 0 AS menor_cotacao';
    solicitacoes = db.prepare(`
      SELECT s.*,u.name AS solicitante_nome,
             (SELECT COUNT(*) FROM solicitacao_itens i WHERE i.solicitacao_id=s.id) AS itens_count
             ${cotacoesSelect}
      FROM solicitacoes s LEFT JOIN users u ON u.id=s.solicitante_user_id
      WHERE s.demanda_id=? ORDER BY s.id DESC
    `).all(id);
  }

  const ordens = hasColumn('os','demanda_id') ? db.prepare(`SELECT id,equipamento,descricao,status,opened_at,closed_at FROM os WHERE demanda_id=? ORDER BY id DESC`).all(id) : [];
  let materiaisEstimados = 0;
  if (hasColumn('solicitacao_itens','custo_estimado_unit')) {
    for (const sol of solicitacoes) {
      const qtdExpr = hasColumn('solicitacao_itens','qtd_solicitada') ? 'qtd_solicitada' : 'quantidade';
      const row = db.prepare(`SELECT COALESCE(SUM(COALESCE(custo_estimado_unit,0)*COALESCE(${qtdExpr},0)),0) AS total FROM solicitacao_itens WHERE solicitacao_id=?`).get(sol.id);
      materiaisEstimados += Number(row?.total || 0);
    }
  }
  const cotado = solicitacoes.reduce((total,sol) => total + Number(sol.menor_cotacao || 0),0);

  return {
    ...demanda,
    logs,
    subdemandas,
    solicitacoes,
    ordens,
    custos: {
      materiais_estimados: materiaisEstimados,
      servicos_estimados: Number(demanda.custo_servicos_estimado || 0),
      total_estimado: materiaisEstimados + Number(demanda.custo_servicos_estimado || 0),
      total_cotado_referencia: cotado,
    },
  };
}

function create(data) {
  if (!String(data.titulo || '').trim()) throw new Error('Informe o título da demanda.');
  const categoria = CATEGORIAS.includes(String(data.categoria || '').toUpperCase()) ? String(data.categoria).toUpperCase() : 'MANUTENCAO';
  const info = db.prepare(`
    INSERT INTO demandas (titulo,descricao,prioridade,status,created_by,demanda_pai_id,equipamento_id,categoria,setor_origem,nr_referencia,prazo_previsto,custo_servicos_estimado,created_at,updated_at)
    VALUES (?,?,?,'NOVA',?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
  `).run(
    String(data.titulo).trim(), data.descricao || null, String(data.prioridade || 'NORMAL').toUpperCase(), data.created_by,
    data.demanda_pai_id ? Number(data.demanda_pai_id) : null, data.equipamento_id ? Number(data.equipamento_id) : null,
    categoria, data.setor_origem || null, data.nr_referencia || null, data.prazo_previsto || null, Number(data.custo_servicos_estimado || 0)
  );
  const id = Number(info.lastInsertRowid);
  db.prepare(`INSERT INTO demanda_logs (demanda_id,user_id,texto,created_at) VALUES (?,?,?,datetime('now'))`).run(id,data.created_by || null,data.demanda_pai_id ? `Subdemanda criada vinculada à demanda #${data.demanda_pai_id}` : 'Demanda criada');
  return id;
}

function updateStatus(id,{ status,responsavel_user_id,aprovacao_status,user_id }) {
  const st = String(status || '').toUpperCase();
  if (!STATUS.includes(st)) throw new Error('Status inválido');
  const ap = String(aprovacao_status || '').toUpperCase();
  if (ap && !APROVACAO_STATUS.includes(ap)) throw new Error('Situação de aprovação inválida');
  const current = getById(id);
  if (!current) throw new Error('Demanda não encontrada');
  let startedAt = current.started_at;
  let finishedAt = current.finished_at;
  if (st === 'EM_ANDAMENTO' && !startedAt) startedAt = new Date().toISOString();
  if (st === 'CONCLUIDA' && !finishedAt) finishedAt = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`UPDATE demandas SET status=?,responsavel_user_id=?,aprovacao_status=COALESCE(?,aprovacao_status),started_at=?,finished_at=?,updated_at=datetime('now') WHERE id=?`).run(st,responsavel_user_id ? Number(responsavel_user_id) : null,ap || null,startedAt,finishedAt,id);
    db.prepare(`INSERT INTO demanda_logs (demanda_id,user_id,texto,created_at) VALUES (?,?,?,datetime('now'))`).run(id,user_id || null,`Status atualizado para ${st}${ap ? ` | Aprovação: ${ap}` : ''}`);
  })();
}

function addUpdate(id,texto,user_id) {
  if (!String(texto || '').trim()) throw new Error('Atualização vazia.');
  db.transaction(() => {
    db.prepare(`INSERT INTO demanda_logs (demanda_id,user_id,texto,created_at) VALUES (?,?,?,datetime('now'))`).run(id,user_id || null,String(texto).trim());
    db.prepare(`UPDATE demandas SET ultima_atualizacao=?,updated_at=datetime('now') WHERE id=?`).run(String(texto).trim(),id);
  })();
}

function createMaterialSolicitacao(id,{ userId,titulo,descricao,prioridade,itens }) {
  const d = getById(id);
  if (!d) throw new Error('Demanda não encontrada');
  if (!Array.isArray(itens) || !itens.length) throw new Error('Informe ao menos um material.');
  const solicitacaoId = solicitacoesService.createSolicitacao({
    userId,
    setor_origem: d.setor_origem || 'Manutenção',
    prioridade: prioridade || d.prioridade || 'MEDIA',
    titulo: titulo || `Materiais - Demanda #${d.id} - ${d.titulo}`,
    descricao: descricao || `Planejamento antecipado de materiais da demanda #${d.id}. Cotação permitida; compra depende de autorização/priorização da demanda.`,
    equipamento_id: d.equipamento_id || null,
    preventiva_id: null,
    os_id: null,
    demanda_id: d.id,
    tipo_origem: 'DEMANDA',
    itens,
  });
  db.prepare(`UPDATE demandas SET status=CASE WHEN status IN ('NOVA','EM_ANALISE') THEN 'PLANEJAMENTO' ELSE status END,updated_at=datetime('now') WHERE id=?`).run(id);
  db.prepare(`INSERT INTO demanda_logs (demanda_id,user_id,texto,created_at) VALUES (?,?,?,datetime('now'))`).run(id,userId || null,`Solicitação de materiais #${solicitacaoId} criada para pré-cotação.`);
  return solicitacaoId;
}

function convertToOS(id,openedBy) {
  const d = getById(id);
  if (!d) throw new Error('Demanda não encontrada');
  if (d.aprovacao_status === 'REPROVADA') throw new Error('Demanda reprovada não pode ser convertida em OS.');
  const existing = hasColumn('os','demanda_id') ? db.prepare('SELECT id FROM os WHERE demanda_id=? ORDER BY id DESC LIMIT 1').get(id) : null;
  if (existing?.id) return Number(existing.id);
  const equipamento = d.equipamento_nome || d.setor_origem || 'DEMANDA';
  const tipo = d.categoria === 'NR' ? 'NR12' : 'OUTRA';
  return db.transaction(() => {
    const info = db.prepare(`INSERT INTO os (equipamento,equipamento_id,descricao,tipo,status,opened_by,demanda_id) VALUES (?,?,?,?,'ABERTA',?,?)`).run(equipamento,d.equipamento_id || null,`[Demanda #${d.id}] ${d.titulo}\n${d.descricao || ''}`,tipo,openedBy || null,d.id);
    const osId = Number(info.lastInsertRowid);
    if (tableExists('solicitacoes') && hasColumn('solicitacoes','os_id')) db.prepare(`UPDATE solicitacoes SET os_id=?,tipo_origem='DEMANDA_OS' WHERE demanda_id=? AND os_id IS NULL`).run(osId,id);
    db.prepare(`UPDATE demandas SET status='EM_ANDAMENTO',aprovacao_status=CASE WHEN aprovacao_status='NAO_SUBMETIDA' THEN 'APROVADA' ELSE aprovacao_status END,started_at=COALESCE(started_at,datetime('now')),updated_at=datetime('now') WHERE id=?`).run(id);
    db.prepare(`INSERT INTO demanda_logs (demanda_id,user_id,texto,created_at) VALUES (?,?,?,datetime('now'))`).run(id,openedBy || null,`Convertida para OS #${osId}; solicitações de materiais existentes foram vinculadas à OS sem duplicação.`);
    return osId;
  })();
}

function getResumoDashboard() {
  const row = db.prepare(`SELECT SUM(CASE WHEN status='NOVA' THEN 1 ELSE 0 END) AS novas,SUM(CASE WHEN status IN ('EM_ANDAMENTO','PLANEJAMENTO','AGUARDANDO_APROVACAO','APROVADA') THEN 1 ELSE 0 END) AS em_andamento,SUM(CASE WHEN status='PARADA' THEN 1 ELSE 0 END) AS paradas FROM demandas`).get() || {};
  const emTrabalhoAgora = db.prepare(`SELECT id,titulo,prioridade,updated_at FROM demandas WHERE status IN ('EM_ANDAMENTO','PLANEJAMENTO','AGUARDANDO_APROVACAO','APROVADA') ORDER BY datetime(updated_at) DESC LIMIT 8`).all();
  return { novas:Number(row.novas || 0),em_andamento:Number(row.em_andamento || 0),paradas:Number(row.paradas || 0),emTrabalhoAgora };
}
function listResponsaveis() { return db.prepare(`SELECT id,name,role FROM users WHERE active=1 ORDER BY name`).all(); }
function listEquipamentos() { return db.prepare(`SELECT id,nome FROM equipamentos ORDER BY nome`).all(); }
function listDemandasPai(excludeId) {
  const params = []; let where = "status NOT IN ('CONCLUIDA','CANCELADA')";
  if (excludeId) { where += ' AND id<>?'; params.push(Number(excludeId)); }
  return db.prepare(`SELECT id,titulo,status FROM demandas WHERE ${where} ORDER BY id DESC`).all(...params);
}
function getCounters(user) {
  return list({},user).reduce((acc,d) => {
    acc.total += 1;
    if (['CONCLUIDA','CANCELADA'].includes(d.status)) acc.concluidas += 1; else acc.ativas += 1;
    if (d.status === 'NOVA') acc.novas += 1;
    if (d.status === 'EM_ANALISE') acc.em_analise += 1;
    if (['PLANEJAMENTO','AGUARDANDO_APROVACAO','APROVADA','EM_ANDAMENTO'].includes(d.status)) acc.em_andamento += 1;
    if (d.status === 'PARADA') acc.paradas += 1;
    if (['URGENTE','ALTA'].includes(d.prioridade)) acc.criticas_altas += 1;
    return acc;
  },{ total:0,ativas:0,concluidas:0,novas:0,em_analise:0,em_andamento:0,paradas:0,criticas_altas:0 });
}

module.exports = { STATUS,CATEGORIAS,APROVACAO_STATUS,list,getById,create,updateStatus,addUpdate,createMaterialSolicitacao,convertToOS,getResumoDashboard,listResponsaveis,listEquipamentos,listDemandasPai,getCounters };
