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
      equipamento_id || null,
      preventiva_id || null,
      os_id || null,
      demanda_id || null,
      STATUS.ABERTA
    );
    const solicitacaoId = Number(info.lastInsertRowid);
    for (const item of itens || []) {
      insertItem.run(
        solicitacaoId,
        item.item_nome,
        item.item_descricao || null,
        (item.unidade || "UN").toUpperCase(),
        item.categoria_id || null,
        item.estoque_item_id || null,
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
  const itens = db.prepare(`
    SELECT si.*, (si.qtd_solicitada - si.qtd_recebida_total) AS qtd_pendente, ei.codigo AS estoque_codigo
    FROM solicitacao_itens si
    LEFT JOIN estoque_itens ei ON ei.id = si.estoque_item_id
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
