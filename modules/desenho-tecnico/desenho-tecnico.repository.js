const db = require('../../database/db');

function list(filters = {}) {
  const where = ['1=1'];
  const params = {};
  if (filters.categoria) { where.push('d.categoria = @categoria'); params.categoria = filters.categoria; }
  if (filters.subtipo) { where.push('d.subtipo = @subtipo'); params.subtipo = filters.subtipo; }
  if (filters.tipo_origem) { where.push('d.tipo_origem = @tipo_origem'); params.tipo_origem = filters.tipo_origem; }
  if (filters.q) { where.push('(d.codigo LIKE @q OR d.titulo LIKE @q)'); params.q = `%${filters.q}%`; }

  return db.prepare(`
    SELECT d.*, e.nome AS equipamento_nome, u.name AS criado_por_nome,
      (SELECT COUNT(*) FROM desenho_arquivos a WHERE a.desenho_id = d.id AND a.tipo_arquivo='PDF') AS total_pdfs
    FROM desenhos_tecnicos d
    LEFT JOIN equipamentos e ON e.id = d.equipamento_id
    LEFT JOIN users u ON u.id = d.criado_por
    WHERE ${where.join(' AND ')}
    ORDER BY datetime(d.atualizado_em) DESC
  `).all(params);
}

function getById(id) {
  return db.prepare(`
    SELECT d.*, e.nome AS equipamento_nome, u.name AS criado_por_nome
    FROM desenhos_tecnicos d
    LEFT JOIN equipamentos e ON e.id = d.equipamento_id
    LEFT JOIN users u ON u.id = d.criado_por
    WHERE d.id=?
  `).get(Number(id));
}

function create(data) {
  const info = db.prepare(`
    INSERT INTO desenhos_tecnicos
    (codigo, titulo, categoria, subtipo, descricao, equipamento_id, status, revisao, material, observacoes, historico_revisao, criado_por, tipo_origem, modo_cad_ativo, json_cad, json_3d, preview_3d_path, criado_em, atualizado_em)
    VALUES (@codigo, @titulo, @categoria, @subtipo, @descricao, @equipamento_id, @status, @revisao, @material, @observacoes, @historico_revisao, @criado_por, @tipo_origem, @modo_cad_ativo, @json_cad, @json_3d, @preview_3d_path, datetime('now'), datetime('now'))
  `).run(data);
  return Number(info.lastInsertRowid);
}

function update(id, data) {
  db.prepare(`
    UPDATE desenhos_tecnicos
    SET codigo=@codigo, titulo=@titulo, categoria=@categoria, subtipo=@subtipo, descricao=@descricao,
        equipamento_id=@equipamento_id, status=@status, revisao=@revisao, material=@material,
        observacoes=@observacoes, historico_revisao=@historico_revisao, tipo_origem=@tipo_origem,
        modo_cad_ativo=@modo_cad_ativo, json_cad=@json_cad, json_3d=@json_3d, preview_3d_path=@preview_3d_path,
        atualizado_em=datetime('now')
    WHERE id=@id
  `).run({ ...data, id: Number(id) });
}

function updateCadData(id, payload = {}) {
  db.prepare(`
    UPDATE desenhos_tecnicos
    SET json_cad=@json_cad,
        json_3d=@json_3d,
        modo_cad_ativo=1,
        tipo_origem='cad',
        preview_3d_path=@preview_3d_path,
        atualizado_em=datetime('now')
    WHERE id=@id
  `).run({ id: Number(id), json_cad: payload.json_cad || null, json_3d: payload.json_3d || null, preview_3d_path: payload.preview_3d_path || null });
}

function replaceCadObjects(desenhoId, objetos = []) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM desenho_cad_objetos WHERE desenho_id=?').run(Number(desenhoId));
    const stmt = db.prepare(`INSERT INTO desenho_cad_objetos
      (desenho_id, tipo_objeto, camada, ordem, x, y, x2, y2, largura, altura, raio, angulo, rotacao, espessura, texto, estilo_json, props_json, criado_em, atualizado_em)
      VALUES (@desenho_id, @tipo_objeto, @camada, @ordem, @x, @y, @x2, @y2, @largura, @altura, @raio, @angulo, @rotacao, @espessura, @texto, @estilo_json, @props_json, datetime('now'), datetime('now'))`);
    objetos.forEach((obj, idx) => stmt.run({
      desenho_id: Number(desenhoId),
      tipo_objeto: obj.type || 'objeto',
      camada: obj.layer || 'geometria_principal',
      ordem: idx,
      x: obj.x ?? null,
      y: obj.y ?? null,
      x2: obj.x2 ?? null,
      y2: obj.y2 ?? null,
      largura: obj.width ?? null,
      altura: obj.height ?? null,
      raio: obj.radius ?? null,
      angulo: obj.angle ?? null,
      rotacao: obj.rotation ?? null,
      espessura: obj.thickness ?? null,
      texto: obj.text ?? null,
      estilo_json: JSON.stringify(obj.style || {}),
      props_json: JSON.stringify(obj),
    }));
  });
  tx();
}

function insertCadHistory(desenhoId, acao, payloadJson, criadoPor) {
  db.prepare(`INSERT INTO desenho_cad_historico (desenho_id, acao, payload_json, criado_por, criado_em)
    VALUES (?, ?, ?, ?, datetime('now'))`).run(Number(desenhoId), acao, payloadJson || null, criadoPor || null);
}

function inactivate(id) { db.prepare(`UPDATE desenhos_tecnicos SET status='INATIVO', atualizado_em=datetime('now') WHERE id=?`).run(Number(id)); }
function duplicate(id, novoCodigo, criadoPor) {
  const row = getById(id);
  if (!row) return null;
  return create({
    ...row,
    codigo: novoCodigo,
    titulo: `${row.titulo} (cópia)`,
    revisao: 0,
    status: 'ATIVO',
    historico_revisao: 'Duplicado do desenho #' + row.id,
    criado_por: criadoPor || row.criado_por,
  });
}

function saveArquivo(desenhoId, payload) {
  db.prepare(`INSERT INTO desenho_arquivos (desenho_id, tipo_arquivo, svg_source, arquivo_pdf, preview_path, revisao, criado_em)
    VALUES (@desenho_id, @tipo_arquivo, @svg_source, @arquivo_pdf, @preview_path, @revisao, datetime('now'))`).run({ desenho_id: Number(desenhoId), ...payload });
}

function listRevisoes(desenhoId) {
  return db.prepare(`SELECT * FROM desenho_arquivos WHERE desenho_id=? ORDER BY revisao DESC, id DESC`).all(Number(desenhoId));
}

function listBiblioteca(filters = {}) {
  const where = ['ativo = 1'];
  const params = {};
  if (filters.categoria) { where.push('categoria=@categoria'); params.categoria = filters.categoria; }
  if (filters.subtipo) { where.push('subtipo=@subtipo'); params.subtipo = filters.subtipo; }
  if (filters.q) { where.push('(nome LIKE @q OR descricao LIKE @q)'); params.q = `%${filters.q}%`; }
  return db.prepare(`SELECT * FROM desenho_blocos WHERE ${where.join(' AND ')} ORDER BY atualizado_em DESC`).all(params);
}

function listAplicacoesByEquipamento(equipamentoId) {
  return db.prepare(`
    SELECT d.id, d.codigo, d.titulo, d.categoria, d.revisao, d.tipo_origem,
      (SELECT arquivo_pdf FROM desenho_arquivos da WHERE da.desenho_id=d.id AND da.tipo_arquivo='PDF' ORDER BY da.id DESC LIMIT 1) AS arquivo_pdf
    FROM desenho_aplicacoes a
    INNER JOIN desenhos_tecnicos d ON d.id = a.desenho_id
    WHERE a.equipamento_id=?
    ORDER BY d.atualizado_em DESC
  `).all(Number(equipamentoId));
}

function vincularEquipamento(desenhoId, equipamentoId, posicaoAplicacao, observacao) {
  db.prepare(`INSERT INTO desenho_aplicacoes (desenho_id, equipamento_id, posicao_aplicacao, observacao, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).run(Number(desenhoId), Number(equipamentoId), posicaoAplicacao || null, observacao || null);
  db.prepare(`UPDATE desenhos_tecnicos SET equipamento_id=?, atualizado_em=datetime('now') WHERE id=?`).run(Number(equipamentoId), Number(desenhoId));
}

module.exports = {
  list,
  getById,
  create,
  update,
  updateCadData,
  replaceCadObjects,
  insertCadHistory,
  inactivate,
  duplicate,
  saveArquivo,
  listRevisoes,
  listBiblioteca,
  listAplicacoesByEquipamento,
  vincularEquipamento,
};
