const fs = require("fs");
const path = require("path");
const db = require("../../database/db");

const STATUS = Object.freeze({
  ABERTA: "ABERTA",
  EM_COTACAO: "EM_COTACAO",
  COMPRADA: "COMPRADA",
  EM_RECEBIMENTO: "EM_RECEBIMENTO",
  RECEBIDA_PARCIAL: "RECEBIDA_PARCIAL",
  RECEBIDA_TOTAL: "RECEBIDA_TOTAL",
  FECHADA: "FECHADA",
  REABERTA: "REABERTA",
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
  return STATUS_COMPRAS.includes(status) ? status : "";
}

function listSolicitacoesPorStatus(filters = {}) {
  const where = [];
  const params = [];
  const status = normalizeStatus(filters.status);

  if (status) {
    where.push("s.status = ?");
    params.push(status);
  }

  if (filters.query) {
    where.push("(LOWER(s.numero) LIKE ? OR LOWER(s.titulo) LIKE ?)");
    const q = `%${String(filters.query).trim().toLowerCase()}%`;
    params.push(q, q);
  }

  if (filters.startDate) {
    where.push("date(s.created_at) >= date(?)");
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    where.push("date(s.created_at) <= date(?)");
    params.push(filters.endDate);
  }

  return db.prepare(`
    SELECT s.*, u.name AS solicitante_nome
    FROM solicitacoes s
    JOIN users u ON u.id = s.solicitante_user_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY s.id DESC
  `).all(...params);
}

function getResumoSolicitacoes() {
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS total
    FROM solicitacoes
    GROUP BY status
  `).all();

  const totals = Object.fromEntries(STATUS_COMPRAS.map((status) => [status, 0]));
  rows.forEach((row) => {
    if (row.status in totals) totals[row.status] = row.total;
  });
  return totals;
}

function getSolicitacaoDetalhe(id) {
  const sol = db.prepare(`
    SELECT s.*, u.name AS solicitante_nome, u.role AS solicitante_role, e.nome AS equipamento_nome
    FROM solicitacoes s
    JOIN users u ON u.id = s.solicitante_user_id
    LEFT JOIN equipamentos e ON e.id = s.equipamento_id
    WHERE s.id = ?
  `).get(id);
  if (!sol) return null;

  const itens = db.prepare(`
    SELECT si.*
    FROM solicitacao_itens si
    WHERE si.solicitacao_id = ?
    ORDER BY si.id
  `).all(id);

  return { ...sol, itens };
}

function assumirSolicitacao(id, userId) {
  const cur = getSolicitacaoDetalhe(id);
  if (!cur || cur.status !== STATUS.ABERTA) throw new Error("Somente solicitações ABERTAS podem ser assumidas.");
  db.prepare(`
    UPDATE solicitacoes
    SET status = ?, compras_user_id = ?, cotacao_inicio_em = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(STATUS.EM_COTACAO, userId, id);
}

function atualizarDados(id, dados) {
  db.prepare(`
    UPDATE solicitacoes
    SET fornecedor = ?,
        previsao_entrega = ?,
        observacoes_compras = ?,
        valor_total = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    dados.fornecedor || null,
    dados.previsao_entrega || null,
    dados.observacoes_compras || null,
    dados.valor_total ? Number(dados.valor_total) : null,
    id
  );
}

function marcarComprada(id, userId, dados = {}) {
  const cur = getSolicitacaoDetalhe(id);
  if (!cur || cur.status !== STATUS.EM_COTACAO) throw new Error("Somente EM_COTACAO pode virar COMPRADA.");

  db.prepare(`
    UPDATE solicitacoes
    SET status = ?,
        compras_user_id = ?,
        comprada_em = datetime('now'),
        fornecedor = ?,
        previsao_entrega = ?,
        observacoes_compras = ?,
        valor_total = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    STATUS.COMPRADA,
    userId,
    dados.fornecedor || cur.fornecedor || null,
    dados.previsao_entrega || cur.previsao_entrega || null,
    dados.observacoes_compras || cur.observacoes_compras || null,
    dados.valor_total ? Number(dados.valor_total) : cur.valor_total || null,
    id
  );
}

function gerarPdf(solicitacao, res) {
  const PDFDocument = getPDFKit();
  if (!PDFDocument) {
    const err = new Error("PDF indisponível: pdfkit não carregou");
    err.code = "PDFKIT_NOT_AVAILABLE";
    throw err;
  }
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=solicitacao_${solicitacao.numero}.pdf`);
  doc.pipe(res);

  const logoPath = ["public/IMG/logopdf_campo_do_gado.png.png", "public/img/logo_menu_256.png", "public/img/logo.png"]
    .map((p) => path.join(process.cwd(), p))
    .find((p) => fs.existsSync(p));
  if (logoPath) doc.image(logoPath, 40, 30, { width: 60 });

  doc.fillColor("#166534").fontSize(16).text("RECICLAGEM CAMPO DO GADO", 120, 35);
  doc.fillColor("#15803d").fontSize(11).text("MANUTENÇÃO INDUSTRIAL", 120, 55);
  doc.fillColor("#111827").fontSize(13).text("SOLICITAÇÃO DE MATERIAL / COTAÇÃO", 40, 95);
  doc.fontSize(10).text(`Número: ${solicitacao.numero}`, 40, 115).text(`Data: ${fmtBR(new Date().toISOString())}`, 260, 115);

  let y = 145;
  const linha = (k, v) => {
    doc.font("Helvetica-Bold").text(`${k}:`, 40, y, { continued: true });
    doc.font("Helvetica").text(` ${v || "-"}`);
    y += 16;
  };

  linha("Solicitante", solicitacao.solicitante_nome);
  linha("Setor", solicitacao.setor_origem);
  linha("Prioridade", solicitacao.prioridade);
  linha("Equipamento", solicitacao.equipamento_nome);
  linha("Vínculos", solicitacao.preventiva_id || solicitacao.os_id || solicitacao.demanda_id ? `Prev:${solicitacao.preventiva_id || "-"} | OS:${solicitacao.os_id || "-"} | Demanda:${solicitacao.demanda_id || "-"}` : "-");
  linha("Descrição", solicitacao.descricao);

  y += 8;
  doc.rect(40, y, 515, 20).strokeColor("#e5e7eb").stroke();
  doc.fontSize(9).font("Helvetica-Bold")
    .text("Item", 44, y + 6)
    .text("Descrição", 170, y + 6)
    .text("Unidade", 360, y + 6)
    .text("Qtde Solicitada", 420, y + 6)
    .text("Observação", 500, y + 6);
  y += 22;

  doc.font("Helvetica");
  for (const it of solicitacao.itens || []) {
    doc.rect(40, y, 515, 22).strokeColor("#e5e7eb").stroke();
    doc.text(it.item_nome || "-", 44, y + 6, { width: 120 })
      .text(it.item_descricao || "-", 170, y + 6, { width: 180 })
      .text(it.unidade || "UN", 360, y + 6, { width: 50 })
      .text(String(it.qtd_solicitada || 0), 420, y + 6, { width: 75 })
      .text(it.observacao_item || "", 500, y + 6, { width: 50 });
    y += 22;
  }

  y += 28;
  doc.text("Compras ____________________", 40, y)
    .text("Solicitante ____________________", 220, y)
    .text("Almoxarifado ____________________", 400, y);

  doc.end();
}

module.exports = {
  STATUS_COMPRAS,
  STATUS,
  listSolicitacoesPorStatus,
  getResumoSolicitacoes,
  getSolicitacaoDetalhe,
  assumirSolicitacao,
  atualizarDados,
  marcarComprada,
  gerarPdf,
};
