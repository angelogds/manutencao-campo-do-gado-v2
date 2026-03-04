const db = require("../../database/db");
const { normalizeRole } = require("../../config/rbac");

const STATUS = {
  ABERTA: "ABERTA",
  EM_COTACAO: "EM_COTACAO",
  COMPRADA: "COMPRADA",
  EM_RECEBIMENTO: "EM_RECEBIMENTO",
  RECEBIDA_PARCIAL: "RECEBIDA_PARCIAL",
  RECEBIDA_TOTAL: "RECEBIDA_TOTAL",
  FECHADA: "FECHADA",
  REABERTA: "REABERTA",
};

function canManageByRole(role) {
  const r = normalizeRole(role);
  return {
    isAdmin: r === "ADMIN",
    isCompras: r === "COMPRAS",
    isAlmox: r === "ALMOXARIFADO",
    isSolicitante: ["ENCARREGADO_MANUTENCAO", "MANUTENCAO_SUPERVISOR", "ENCARREGADO_PRODUCAO"].includes(r),
  };
}

function nextNumero() {
  const year = new Date().getFullYear();
  const like = `SOL-${year}-%`;
  const row = db.prepare("SELECT numero FROM solicitacoes WHERE numero LIKE ? ORDER BY id DESC LIMIT 1").get(like);
  const seq = row?.numero ? Number(String(row.numero).split("-").pop()) + 1 : 1;
  return `SOL-${year}-${String(seq).padStart(6, "0")}`;
}

function sanitizePositiveId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getTableColumns(table) {
  try { return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name); }
  catch { return []; }
}

function createSolicitacao({ userId, setor_origem, prioridade, titulo, descricao, equipamento_id, preventiva_id, os_id, demanda_id, itens }) {
  const insertSol = db.prepare(`
    INSERT INTO solicitacoes (
      numero, solicitante_user_id, setor_origem, prioridade, titulo, descricao, equipamento_id, preventiva_id, os_id, demanda_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO solicitacao_itens (
      solicitacao_id, item_nome, item_descricao, unidade, categoria_id, estoque_item_id, qtd_solicitada
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  return db.transaction(() => {
    const numero = nextNumero();
    const info = insertSol.run(
      numero,
      userId,
      setor_origem || "Manutenção",
      prioridade || "MEDIA",
      titulo,
      descricao || null,
      sanitizePositiveId(equipamento_id),
      sanitizePositiveId(preventiva_id),
      sanitizePositiveId(os_id),
      sanitizePositiveId(demanda_id),
      STATUS.ABERTA
    );

    const solicitacaoId = Number(info.lastInsertRowid);

    for (const item of itens || []) {
      const categoria_id = sanitizePositiveId(item.categoria_id);
      const estoque_item_id = sanitizePositiveId(item.estoque_item_id);

      insertItem.run(
        solicitacaoId,
        item.item_nome,
        item.item_descricao || null,
        (item.unidade || "UN").toUpperCase(),
        categoria_id,
        estoque_item_id,
        Number(item.qtd_solicitada || 0)
      );
    }

    return solicitacaoId;
  })();
}

function listMinhasSolicitacoes(userId) {
  return db.prepare(`
    SELECT s.*, u.name AS solicitante_nome,
      (SELECT COUNT(*) FROM solicitacao_itens i WHERE i.solicitacao_id = s.id) AS itens_count
    FROM solicitacoes s
    JOIN users u ON u.id = s.solicitante_user_id
    WHERE s.solicitante_user_id = ?
    ORDER BY s.id DESC
  `).all(userId);
}

function getCountersForUser(userId) {
  const rows = db.prepare("SELECT status, COUNT(*) AS total FROM solicitacoes WHERE solicitante_user_id = ? GROUP BY status").all(userId);
  const counters = Object.values(STATUS).reduce((acc, st) => ({ ...acc, [st]: 0 }), {});
  rows.forEach((r) => { counters[r.status] = r.total; });
  return counters;
}

function getSolicitacaoById(id) {
  const sol = db.prepare(`
    SELECT s.*, u.name AS solicitante_nome, u.role AS solicitante_role, cu.name AS compras_nome, au.name AS almox_nome,
           e.nome AS equipamento_nome
    FROM solicitacoes s
    JOIN users u ON u.id = s.solicitante_user_id
    LEFT JOIN users cu ON cu.id = s.compras_user_id
    LEFT JOIN users au ON au.id = s.almox_user_id
    LEFT JOIN equipamentos e ON e.id = s.equipamento_id
    WHERE s.id = ?
  `).get(id);
  if (!sol) return null;

  const cols = getTableColumns('solicitacao_itens');
  const has = (c) => cols.includes(c);
  const exprItemNome = has('item_nome') ? 'si.item_nome' : has('descricao') ? 'si.descricao' : "'-'";
  const exprItemDesc = has('item_descricao') ? 'si.item_descricao' : has('descricao') ? 'si.descricao' : 'NULL';
  const exprUnidade = has('unidade') ? 'si.unidade' : "'UN'";
  const exprQtdSolic = has('qtd_solicitada') ? 'si.qtd_solicitada' : has('quantidade') ? 'si.quantidade' : '0';
  const exprQtdRec = has('qtd_recebida_total') ? 'si.qtd_recebida_total' : '0';
  const exprStatusItem = has('status_item') ? 'si.status_item' : "'PENDENTE'";
  const exprObs = has('observacao_item') ? 'si.observacao_item' : has('descricao') ? 'si.descricao' : 'NULL';
  const exprEstoqueRef = has('estoque_item_id') ? 'si.estoque_item_id' : has('item_id') ? 'si.item_id' : 'NULL';

  const itens = db.prepare(`
    SELECT
      si.id,
      ${exprItemNome} AS item_nome,
      ${exprItemDesc} AS item_descricao,
      ${exprUnidade} AS unidade,
      ${exprQtdSolic} AS qtd_solicitada,
      ${exprQtdRec} AS qtd_recebida_total,
      (${exprQtdSolic} - ${exprQtdRec}) AS qtd_pendente,
      ${exprStatusItem} AS status_item,
      ${exprObs} AS observacao_item,
      ei.codigo AS estoque_codigo
    FROM solicitacao_itens si
    LEFT JOIN estoque_itens ei ON ei.id = ${exprEstoqueRef}
    WHERE si.solicitacao_id = ?
    ORDER BY si.id
  `).all(id);

  return { ...sol, itens };
}

function listEquipamentos() {
  return db.prepare("SELECT id, nome FROM equipamentos ORDER BY nome").all();
}

function listEstoqueItens() {
  return db.prepare("SELECT id, codigo, nome, unidade FROM estoque_itens WHERE ativo = 1 ORDER BY nome").all();
}

module.exports = { STATUS, canManageByRole, createSolicitacao, listMinhasSolicitacoes, getCountersForUser, getSolicitacaoById, listEquipamentos, listEstoqueItens };
