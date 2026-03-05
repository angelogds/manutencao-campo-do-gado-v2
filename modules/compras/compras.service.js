const fs = require('fs');
const path = require('path');
const db = require('../../database/db');

const STATUS = Object.freeze({
  ABERTA: 'ABERTA',
  EM_COTACAO: 'EM_COTACAO',
  COMPRADA: 'COMPRADA',
  EM_RECEBIMENTO: 'EM_RECEBIMENTO',
  RECEBIDA_PARCIAL: 'RECEBIDA_PARCIAL',
  RECEBIDA_TOTAL: 'RECEBIDA_TOTAL',
  FECHADA: 'FECHADA',
  REABERTA: 'REABERTA',
});

const STATUS_COMPRAS = [
  STATUS.ABERTA,
  STATUS.EM_COTACAO,
  STATUS.COMPRADA,
  STATUS.EM_RECEBIMENTO,
  STATUS.RECEBIDA_PARCIAL,
  STATUS.RECEBIDA_TOTAL,
  STATUS.FECHADA,
  STATUS.REABERTA,
];

function normalizeStatus(status) {
  return STATUS_COMPRAS.includes(status) ? status : '';
}

function getPDFKit() {
  try {
    return require('pdfkit');
  } catch (_error) {
    return null;
  }
}

function listSolicitacoesPorStatus(filters = {}) {
  const where = [];
  const params = [];
  const status = normalizeStatus(filters.status);

  if (status) {
    where.push('s.status = ?');
    params.push(status);
  }

  if (filters.query) {
    where.push("(LOWER(s.numero) LIKE ? OR LOWER(s.titulo) LIKE ? OR LOWER(COALESCE(s.fornecedor, '')) LIKE ? OR LOWER(COALESCE(f.nome, '')) LIKE ?)");
    const q = `%${String(filters.query).trim().toLowerCase()}%`;
    params.push(q, q, q, q);
  }

  if (filters.startDate) {
    where.push('date(s.created_at) >= date(?)');
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    where.push('date(s.created_at) <= date(?)');
    params.push(filters.endDate);
  }

  return db.prepare(`
    SELECT s.*, u.name AS solicitante_nome, f.nome AS fornecedor_nome
    FROM solicitacoes s
    JOIN users u ON u.id = s.solicitante_user_id
    LEFT JOIN fornecedores f ON f.id = s.fornecedor_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY s.id DESC
  `).all(...params);
}

function getResumoSolicitacoes() {
  const rows = db.prepare('SELECT status, COUNT(*) AS total FROM solicitacoes GROUP BY status').all();
  const totals = Object.fromEntries(STATUS_COMPRAS.map((status) => [status, 0]));
  rows.forEach((row) => {
    if (row.status in totals) totals[row.status] = row.total;
  });
  return totals;
}

function listFornecedoresAtivos() {
  return db.prepare('SELECT id, nome, cnpj, cidade FROM fornecedores WHERE ativo = 1 ORDER BY nome ASC').all();
}

function listCotacoes(solicitacaoId) {
  return db.prepare(`
    SELECT c.*, f.nome AS fornecedor_cadastro_nome, f.cnpj
    FROM compras_cotacoes c
    LEFT JOIN fornecedores f ON f.id = c.fornecedor_id
    WHERE c.solicitacao_id = ?
    ORDER BY c.id DESC
  `).all(solicitacaoId);
}

function getCotacaoSelecionada(solicitacaoId) {
  return db.prepare(`
    SELECT c.*, f.nome AS fornecedor_cadastro_nome
    FROM compras_cotacoes c
    LEFT JOIN fornecedores f ON f.id = c.fornecedor_id
    WHERE c.solicitacao_id = ? AND c.selecionada = 1
    ORDER BY c.id DESC LIMIT 1
  `).get(solicitacaoId);
}

function listarAnexos(referenciaTipo, referenciaId) {
  return db.prepare(`
    SELECT a.*, u.name AS uploaded_by_nome
    FROM anexos a
    LEFT JOIN users u ON u.id = a.uploaded_by
    WHERE (a.referencia_tipo = ? AND a.referencia_id = ?)
       OR (a.owner_type = ? AND a.owner_id = ?)
    ORDER BY a.id DESC
  `).all(referenciaTipo, referenciaId, referenciaTipo, referenciaId);
}

function listAnexosSolicitacao(solicitacaoId) {
  return listarAnexos('SOLICITACAO', solicitacaoId);
}

function salvarAnexo({ referencia_tipo, referencia_id, tipo, file, user_id }) {
  if (!file) throw new Error('Arquivo não enviado.');
  if (!referencia_tipo || !referencia_id) throw new Error('Referência inválida.');

  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowed.includes(file.mimetype)) throw new Error('Tipo de arquivo não permitido.');

  const baseUploads = process.env.UPLOADS_DIR || (fs.existsSync('/data') ? '/data/uploads' : path.join(process.cwd(), 'uploads'));
  const filepath = file.path || path.join(baseUploads, file.filename);

  const stmt = db.prepare(`
    INSERT INTO anexos (
      owner_type, owner_id,
      referencia_tipo, referencia_id, tipo,
      filename, filepath, original_name, mime_type, size,
      uploaded_by, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const info = stmt.run(
    referencia_tipo,
    Number(referencia_id),
    referencia_tipo,
    Number(referencia_id),
    tipo || 'COTACAO',
    file.filename,
    filepath,
    file.originalname,
    file.mimetype,
    Number(file.size || 0),
    Number(user_id || null),
  );

  return db.prepare('SELECT * FROM anexos WHERE id = ?').get(info.lastInsertRowid);
}

function getAnexo(anexoId) {
  return db.prepare('SELECT * FROM anexos WHERE id = ?').get(anexoId);
}

function deletarAnexo(anexoId) {
  db.prepare('DELETE FROM anexos WHERE id = ?').run(anexoId);
}

function getHistoricoPrecos(solicitacaoId) {
  return db.prepare(`
    SELECT hp.*, f.nome AS fornecedor_cadastro_nome
    FROM historico_precos hp
    LEFT JOIN fornecedores f ON f.id = hp.fornecedor_id
    WHERE hp.solicitacao_id = ?
       OR hp.item_nome IN (
          SELECT COALESCE(si.item_nome, ei.nome)
          FROM solicitacao_itens si
          LEFT JOIN estoque_itens ei ON ei.id = si.estoque_item_id
          WHERE si.solicitacao_id = ?
       )
    ORDER BY datetime(COALESCE(hp.data_compra, hp.rowid)) DESC
    LIMIT 5
  `).all(solicitacaoId, solicitacaoId);
}

function getSolicitacaoDetalhe(id) {
  const sol = db.prepare(`
    SELECT s.*, u.name AS solicitante_nome, u.role AS solicititante_role, e.nome AS equipamento_nome, f.nome AS fornecedor_nome
    FROM solicitacoes s
    JOIN users u ON u.id = s.solicitante_user_id
    LEFT JOIN equipamentos e ON e.id = s.equipamento_id
    LEFT JOIN fornecedores f ON f.id = s.fornecedor_id
    WHERE s.id = ?
  `).get(id);

  if (!sol) return null;

  const itens = db.prepare(`
    SELECT si.*, COALESCE(si.item_nome, ei.nome) AS item_nome, COALESCE(si.item_descricao, si.descricao) AS item_descricao,
           COALESCE(si.qtd_solicitada, si.quantidade, 0) AS qtd_solicitada
    FROM solicitacao_itens si
    LEFT JOIN estoque_itens ei ON ei.id = si.estoque_item_id
    WHERE si.solicitacao_id = ?
    ORDER BY si.id
  `).all(id);

  return {
    ...sol,
    itens,
    cotacoes: listCotacoes(id),
    anexos: listAnexosSolicitacao(id),
    historicoPrecos: getHistoricoPrecos(id),
    cotacaoSelecionada: getCotacaoSelecionada(id),
  };
}

function assumirSolicitacao(id, userId) {
  const cur = getSolicitacaoDetalhe(id);
  if (!cur || cur.status !== STATUS.ABERTA) throw new Error('Somente solicitações ABERTAS podem ser assumidas.');

  db.prepare(`
    UPDATE solicitacoes
    SET status = ?, compras_user_id = ?, cotacao_inicio_em = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(STATUS.EM_COTACAO, userId, id);
}

function iniciarCotacaoViaPdf(id, userId) {
  const cur = getSolicitacaoDetalhe(id);
  if (!cur) throw new Error('Solicitação não encontrada.');
  if (cur.status === STATUS.ABERTA) {
    db.prepare(`
      UPDATE solicitacoes
      SET status = ?, compras_user_id = ?, cotacao_inicio_em = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(STATUS.EM_COTACAO, userId, id);
  }
}

function createCotacao(solicitacaoId, dados = {}) {
  const fornecedorId = dados.fornecedor_id ? Number(dados.fornecedor_id) : null;
  const fornecedor = fornecedorId
    ? db.prepare('SELECT id, nome FROM fornecedores WHERE id = ?').get(fornecedorId)
    : null;

  db.prepare(`
    INSERT INTO compras_cotacoes (solicitacao_id, fornecedor_id, fornecedor_nome, valor_total, prazo_entrega, observacao, selecionada, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(
    solicitacaoId,
    fornecedor?.id || null,
    fornecedor?.nome || (dados.fornecedor_nome || null),
    dados.valor_total ? Number(dados.valor_total) : null,
    dados.prazo_entrega || null,
    dados.observacao || null,
  );
}

function selecionarCotacao(solicitacaoId, cotacaoId) {
  return db.transaction(() => {
    const cotacao = db.prepare('SELECT * FROM compras_cotacoes WHERE id = ? AND solicitacao_id = ?').get(cotacaoId, solicitacaoId);
    if (!cotacao) throw new Error('Cotação não encontrada para a solicitação.');

    db.prepare('UPDATE compras_cotacoes SET selecionada = 0 WHERE solicitacao_id = ?').run(solicitacaoId);
    db.prepare('UPDATE compras_cotacoes SET selecionada = 1 WHERE id = ?').run(cotacaoId);
  })();
}

function atualizarDados(id, dados) {
  const fornecedorId = dados.fornecedor_id ? Number(dados.fornecedor_id) : null;
  const fornecedorSelecionado = fornecedorId ? db.prepare('SELECT id, nome FROM fornecedores WHERE id = ?').get(fornecedorId) : null;

  db.prepare(`
    UPDATE solicitacoes
    SET fornecedor = ?, fornecedor_id = ?, previsao_entrega = ?, observacoes_compras = ?, valor_total = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    fornecedorSelecionado?.nome || dados.fornecedor || null,
    fornecedorSelecionado?.id || null,
    dados.previsao_entrega || null,
    dados.observacoes_compras || null,
    dados.valor_total ? Number(dados.valor_total) : null,
    id,
  );
}

function registrarHistoricoPrecos(solicitacao, cotacao) {
  const itens = solicitacao.itens || [];
  const totalQtd = itens.reduce((acc, item) => acc + Number(item.qtd_solicitada || 0), 0);
  const valorTotal = Number(cotacao?.valor_total || solicitacao.valor_total || 0);
  const precoUnitMedio = totalQtd > 0 ? valorTotal / totalQtd : 0;

  const insert = db.prepare(`
    INSERT INTO historico_precos (
      estoque_item_id, item_nome, fornecedor_id, fornecedor_nome, preco_unit, preco_total, unidade, data_compra, solicitacao_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `);

  itens.forEach((item) => {
    const qtd = Number(item.qtd_solicitada || 0);
    const precoTotalItem = qtd * precoUnitMedio;
    insert.run(
      item.estoque_item_id || null,
      item.item_nome || null,
      cotacao?.fornecedor_id || solicitacao.fornecedor_id || null,
      cotacao?.fornecedor_cadastro_nome || cotacao?.fornecedor_nome || solicitacao.fornecedor || null,
      precoUnitMedio || null,
      precoTotalItem || null,
      item.unidade || 'UN',
      solicitacao.id,
    );
  });
}

function marcarComprada(id, userId, dados = {}) {
  const cur = getSolicitacaoDetalhe(id);
  if (!cur || cur.status !== STATUS.EM_COTACAO) throw new Error('Somente EM_COTACAO pode virar COMPRADA.');

  const cotacaoSelecionada = getCotacaoSelecionada(id);
  if (!cotacaoSelecionada) throw new Error('Selecione uma cotação vencedora antes de marcar como COMPRADA.');

  return db.transaction(() => {
    const fornecedorNome = cotacaoSelecionada.fornecedor_cadastro_nome || cotacaoSelecionada.fornecedor_nome || dados.fornecedor || cur.fornecedor || null;
    const fornecedorId = cotacaoSelecionada.fornecedor_id || (dados.fornecedor_id ? Number(dados.fornecedor_id) : cur.fornecedor_id || null);
    const valor = Number(cotacaoSelecionada.valor_total || dados.valor_total || cur.valor_total || 0);

    db.prepare(`
      UPDATE solicitacoes
      SET status = ?, compras_user_id = ?, comprada_em = datetime('now'), fornecedor = ?, fornecedor_id = ?,
          previsao_entrega = ?, observacoes_compras = ?, valor_total = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      STATUS.COMPRADA,
      userId,
      fornecedorNome,
      fornecedorId,
      dados.previsao_entrega || cotacaoSelecionada.prazo_entrega || cur.previsao_entrega || null,
      dados.observacoes_compras || cotacaoSelecionada.observacao || cur.observacoes_compras || null,
      valor || null,
      id,
    );

    registrarHistoricoPrecos({ ...cur, id, fornecedor: fornecedorNome, fornecedor_id: fornecedorId, valor_total: valor }, cotacaoSelecionada);
  })();
}

function gerarPdf(solicitacao, res) {
  const PDFDocument = getPDFKit();
  if (!PDFDocument) {
    const err = new Error('PDF indisponível: pdfkit não carregou');
    err.code = 'PDFKIT_NOT_AVAILABLE';
    throw err;
  }

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=solicitacao_${solicitacao.numero}.pdf`);
  doc.pipe(res);

  const logoPath = ['public/IMG/logopdf_campo_do_gado.png.png', 'public/img/logo_menu_256.png', 'public/img/logo.png']
    .map((p) => path.join(process.cwd(), p))
    .find((p) => fs.existsSync(p));
  if (logoPath) doc.image(logoPath, 40, 30, { width: 60 });

  doc.fillColor('#166534').fontSize(16).text('RECICLAGEM CAMPO DO GADO', 120, 35);
  doc.fillColor('#15803d').fontSize(11).text('MANUTENÇÃO INDUSTRIAL', 120, 55);
  doc.fillColor('#111827').fontSize(13).text('SOLICITAÇÃO DE MATERIAL / COTAÇÃO', 40, 95);
  doc.fontSize(10).text(`Número: ${solicitacao.numero || `#${solicitacao.id}`}`, 40, 115).text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 260, 115);

  let y = 145;
  const linha = (k, v) => {
    doc.font('Helvetica-Bold').text(`${k}:`, 40, y, { continued: true });
    doc.font('Helvetica').text(` ${v || '-'}`);
    y += 16;
  };

  linha('Solicitante', solicitacao.solicitante_nome);
  linha('Setor', solicitacao.setor_origem);
  linha('Prioridade', solicitacao.prioridade);
  linha('Equipamento', solicitacao.equipamento_nome);
  linha('Descrição', solicitacao.descricao);

  y += 8;
  doc.rect(40, y, 515, 20).strokeColor('#e5e7eb').stroke();
  doc.fontSize(9).font('Helvetica-Bold')
    .text('Item', 44, y + 6)
    .text('Descrição', 170, y + 6)
    .text('Unidade', 360, y + 6)
    .text('Qtde Solicitada', 420, y + 6);
  y += 22;

  doc.font('Helvetica');
  for (const it of solicitacao.itens || []) {
    doc.rect(40, y, 515, 22).strokeColor('#e5e7eb').stroke();
    doc.text(it.item_nome || '-', 44, y + 6, { width: 120 })
      .text(it.item_descricao || '-', 170, y + 6, { width: 180 })
      .text(it.unidade || 'UN', 360, y + 6, { width: 50 })
      .text(String(it.qtd_solicitada || 0), 420, y + 6, { width: 75 });
    y += 22;
  }

  doc.end();
}

module.exports = {
  STATUS,
  STATUS_COMPRAS,
  listSolicitacoesPorStatus,
  getResumoSolicitacoes,
  getSolicitacaoDetalhe,
  listFornecedoresAtivos,
  assumirSolicitacao,
  iniciarCotacaoViaPdf,
  createCotacao,
  selecionarCotacao,
  atualizarDados,
  marcarComprada,
  salvarAnexo,
  listarAnexos,
  getAnexo,
  deletarAnexo,
  gerarPdf,
};
