const db = require("../../database/db");

const STATUS = {
  COMPRADA: "COMPRADA",
  EM_RECEBIMENTO: "EM_RECEBIMENTO",
  RECEBIDA_PARCIAL: "RECEBIDA_PARCIAL",
  RECEBIDA_TOTAL: "RECEBIDA_TOTAL",
  FECHADA: "FECHADA",
  REABERTA: "REABERTA",
};

function hasColumn(table, column) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  } catch (_e) {
    return false;
  }
}

const HAS_SALDO_ATUAL = hasColumn("estoque_itens", "saldo_atual");

function listFuncionarios() {
  return db.prepare("SELECT id, codigo, nome FROM almox_funcionarios WHERE ativo = 1 ORDER BY nome").all();
}

function listItensEstoque() {
  const saldoExpr = HAS_SALDO_ATUAL ? "COALESCE(i.saldo_atual,0)" : "COALESCE(v.saldo,0)";
  return db
    .prepare(
      `SELECT i.id, i.codigo, i.nome, i.unidade, ${saldoExpr} AS saldo
       FROM estoque_itens i
       LEFT JOIN vw_estoque_saldo v ON v.item_id = i.id
       WHERE i.ativo = 1
       ORDER BY i.nome`
    )
    .all();
}

function listRetiradas() {
  return db
    .prepare(
      `SELECT r.id, r.quantidade, r.finalidade, r.destino, r.created_at,
              f.codigo AS funcionario_codigo, f.nome AS funcionario_nome,
              i.nome AS item_nome, i.unidade,
              r.solicitacao_id
       FROM almox_retiradas r
       JOIN almox_funcionarios f ON f.id = r.funcionario_id
       JOIN estoque_itens i ON i.id = r.item_id
       ORDER BY r.id DESC
       LIMIT 200`
    )
    .all();
}

function listSolicitacoesRelacionadas() {
  return db
    .prepare(
      `SELECT id, numero, status
       FROM solicitacoes
       WHERE status IN ('ABERTA', 'EM_COTACAO', 'COMPRADA', 'EM_RECEBIMENTO', 'REABERTA')
       ORDER BY id DESC
       LIMIT 100`
    )
    .all();
}

function registrarRetirada({ funcionario_id, item_id, quantidade, finalidade, destino, solicitacao_id, created_by }) {
  const item = listItensEstoque().find((i) => i.id === Number(item_id));
  if (!item) throw new Error("Item não encontrado.");

  const qtd = Number(String(quantidade || "0").replace(",", "."));
  if (!Number.isFinite(qtd) || qtd <= 0) throw new Error("Quantidade inválida.");
  if (qtd > Number(item.saldo || 0)) throw new Error("Saldo insuficiente no estoque.");

  return db.transaction(() => {
    const ret = db
      .prepare(
        `INSERT INTO almox_retiradas (
          funcionario_id, item_id, quantidade, finalidade, destino, solicitacao_id, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        Number(funcionario_id),
        Number(item_id),
        qtd,
        finalidade || null,
        destino || null,
        solicitacao_id ? Number(solicitacao_id) : null,
        created_by || null
      );

    if (HAS_SALDO_ATUAL) {
      db.prepare("UPDATE estoque_itens SET saldo_atual = COALESCE(saldo_atual,0) - ?, updated_at = datetime('now') WHERE id = ?").run(qtd, Number(item_id));
    }

    db.prepare(
      `INSERT INTO estoque_movimentos (tipo, data_mov, item_id, quantidade, usuario_id, referencia_tipo, referencia_id, observacao, created_at)
       VALUES ('SAIDA_REQUISICAO_INTERNA', datetime('now'), ?, ?, ?, 'SOLICITACAO', ?, ?, datetime('now'))`
    ).run(Number(item_id), qtd, created_by || null, solicitacao_id ? Number(solicitacao_id) : null, `Retirada almoxarifado: ${destino || "uso interno"}`);

    return Number(ret.lastInsertRowid);
  })();
}

function listRecebimentos() {
  return db
    .prepare(
      `SELECT s.id, s.numero, s.status, s.prioridade, s.setor_origem, s.comprada_em,
              u.name AS solicitante_nome
       FROM solicitacoes s
       JOIN users u ON u.id = s.solicitante_user_id
       WHERE s.status IN (?, ?, ?, ?, ?)
       ORDER BY s.id DESC`
    )
    .all(STATUS.COMPRADA, STATUS.EM_RECEBIMENTO, STATUS.RECEBIDA_PARCIAL, STATUS.RECEBIDA_TOTAL, STATUS.FECHADA);
}

function getSolicitacao(id) {
  const solicitacao = db
    .prepare(
      `SELECT s.*, u.name AS solicitante_nome
       FROM solicitacoes s
       JOIN users u ON u.id = s.solicitante_user_id
       WHERE s.id = ?`
    )
    .get(id);
  if (!solicitacao) return null;

  const itens = db
    .prepare(
      `SELECT si.*, (si.qtd_solicitada - si.qtd_recebida_total) AS pendente
       FROM solicitacao_itens si
       WHERE si.solicitacao_id = ?
       ORDER BY si.id`
    )
    .all(id);

  return { ...solicitacao, itens };
}

function iniciarRecebimento(id, userId) {
  const solicitacao = getSolicitacao(id);
  if (!solicitacao || ![STATUS.COMPRADA, STATUS.REABERTA].includes(solicitacao.status)) {
    throw new Error("Somente solicitações COMPRADAS/REABERTAS podem iniciar recebimento.");
  }

  db.prepare(
    "UPDATE solicitacoes SET status = ?, almox_user_id = ?, recebimento_inicio_em = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(STATUS.EM_RECEBIMENTO, userId || null, id);
}

function receberItem({ solicitacaoId, itemId, qtdAgora, observacao, userId }) {
  const qtd = Number(String(qtdAgora || "0").replace(",", "."));
  if (!Number.isFinite(qtd) || qtd <= 0) throw new Error("Informe uma quantidade válida.");

  return db.transaction(() => {
    const item = db.prepare("SELECT * FROM solicitacao_itens WHERE id = ? AND solicitacao_id = ?").get(itemId, solicitacaoId);
    if (!item) throw new Error("Item da solicitação não encontrado.");

    const recebidaTotal = Number(item.qtd_recebida_total || 0) + qtd;
    const statusItem = recebidaTotal >= Number(item.qtd_solicitada) ? "OK" : "PARCIAL";

    db.prepare(
      "UPDATE solicitacao_itens SET qtd_recebida_total = ?, status_item = ?, observacao_item = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(recebidaTotal, statusItem, observacao || item.observacao_item || null, itemId);

    if (item.estoque_item_id) {
      if (HAS_SALDO_ATUAL) {
        db.prepare("UPDATE estoque_itens SET saldo_atual = COALESCE(saldo_atual, 0) + ?, updated_at = datetime('now') WHERE id = ?").run(qtd, item.estoque_item_id);
      }

      db.prepare(
        `INSERT INTO estoque_movimentos (tipo, data_mov, item_id, quantidade, usuario_id, referencia_tipo, referencia_id, observacao, created_at)
         VALUES ('ENTRADA_COMPRA', datetime('now'), ?, ?, ?, 'SOLICITACAO', ?, ?, datetime('now'))`
      ).run(item.estoque_item_id, qtd, userId || null, solicitacaoId, observacao || `Recebimento da solicitação ${solicitacaoId}`);
    }
  })();
}

function finalizarRecebimento(id) {
  const itens = db.prepare("SELECT qtd_solicitada, qtd_recebida_total FROM solicitacao_itens WHERE solicitacao_id = ?").all(id);
  if (!itens.length) throw new Error("Solicitação sem itens para conferência.");

  const parcial = itens.some((item) => Number(item.qtd_recebida_total || 0) < Number(item.qtd_solicitada || 0));
  const status = parcial ? STATUS.RECEBIDA_PARCIAL : STATUS.RECEBIDA_TOTAL;

  db.prepare("UPDATE solicitacoes SET status = ?, recebida_em = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(status, id);
}

function fechar(id) {
  const solicitacao = getSolicitacao(id);
  if (!solicitacao || ![STATUS.RECEBIDA_PARCIAL, STATUS.RECEBIDA_TOTAL].includes(solicitacao.status)) {
    throw new Error("Somente solicitações recebidas podem ser fechadas.");
  }

  db.prepare("UPDATE solicitacoes SET status = ?, fechada_em = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(STATUS.FECHADA, id);
}

function reabrir(id) {
  const solicitacao = getSolicitacao(id);
  if (!solicitacao || ![STATUS.FECHADA, STATUS.RECEBIDA_PARCIAL].includes(solicitacao.status)) {
    throw new Error("Somente solicitações FECHADAS ou RECEBIDA_PARCIAL podem ser reabertas.");
  }

  db.prepare("UPDATE solicitacoes SET status = ?, reaberta_em = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(STATUS.REABERTA, id);
}

module.exports = {
  listFuncionarios,
  listItensEstoque,
  listRetiradas,
  listSolicitacoesRelacionadas,
  registrarRetirada,
  listRecebimentos,
  getSolicitacao,
  iniciarRecebimento,
  receberItem,
  finalizarRecebimento,
  fechar,
  reabrir,
};
