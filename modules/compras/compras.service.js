const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const db = require("../../database/db");
const { STATUS } = require("../solicitacoes/solicitacoes.service");
const { fmtBR } = require("../../utils/date");

function listSolicitacoes() {
  return db.prepare(`
    SELECT s.*, u.name AS solicitante_nome
    FROM solicitacoes s
    JOIN users u ON u.id = s.solicitante_user_id
    WHERE s.status IN (?, ?, ?)
    ORDER BY s.id DESC
  `).all(STATUS.ABERTA, STATUS.EM_COTACAO, STATUS.COMPRADA);
}

function getSolicitacao(id) {
  const sol = db.prepare(`SELECT s.*, u.name AS solicitante_nome, u.role AS solicitante_role, e.nome AS equipamento_nome FROM solicitacoes s JOIN users u ON u.id=s.solicitante_user_id LEFT JOIN equipamentos e ON e.id=s.equipamento_id WHERE s.id=?`).get(id);
  if (!sol) return null;
  const itens = db.prepare("SELECT * FROM solicitacao_itens WHERE solicitacao_id = ? ORDER BY id").all(id);
  return { ...sol, itens };
}

function assumirSolicitacao(id, userId) {
  const cur = getSolicitacao(id);
  if (!cur || cur.status !== STATUS.ABERTA) throw new Error("Somente solicitações ABERTAS podem ser assumidas.");
  db.prepare(`UPDATE solicitacoes SET status=?, compras_user_id=?, cotacao_inicio_em=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(STATUS.EM_COTACAO, userId, id);
}

function atualizarDados(id, data) {
  db.prepare(`UPDATE solicitacoes SET fornecedor=?, previsao_entrega=?, observacoes_compras=?, valor_total=?, updated_at=datetime('now') WHERE id=?`).run(
    data.fornecedor || null,
    data.previsao_entrega || null,
    data.observacoes_compras || null,
    data.valor_total ? Number(data.valor_total) : null,
    id
  );
}

function marcarComprada(id) {
  const cur = getSolicitacao(id);
  if (!cur || cur.status !== STATUS.EM_COTACAO) throw new Error("Somente EM_COTACAO pode virar COMPRADA.");
  db.prepare(`UPDATE solicitacoes SET status=?, comprada_em=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(STATUS.COMPRADA, id);
}

function gerarPdf(solicitacao, res) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=solicitacao_${solicitacao.numero}.pdf`);
  doc.pipe(res);

  const logoPath = ["public/img/logo_menu_256.png", "public/img/logo.png"].map((p) => path.join(process.cwd(), p)).find((p) => fs.existsSync(p));
  if (logoPath) doc.image(logoPath, 40, 30, { width: 60 });

  doc.fillColor("#16A34A").fontSize(16).text("RECICLAGEM CAMPO DO GADO", 120, 35);
  doc.fillColor("#15803d").fontSize(11).text("MANUTENÇÃO INDUSTRIAL", 120, 55);
  doc.fillColor("#111827").fontSize(13).text("SOLICITAÇÃO DE MATERIAL / COTAÇÃO", 40, 95);
  doc.fontSize(10).text(`Data emissão: ${fmtBR(new Date().toISOString())}`, 40, 115).text(`Número: ${solicitacao.numero}`, 250, 115);

  let y = 145;
  const linha = (k, v) => { doc.font("Helvetica-Bold").text(`${k}:`, 40, y, { continued: true }); doc.font("Helvetica").text(` ${v || "-"}`); y += 16; };
  linha("Solicitante", `${solicitacao.solicitante_nome} (${solicitacao.solicitante_role || ""})`);
  linha("Setor", solicitacao.setor_origem);
  linha("Prioridade", solicitacao.prioridade);
  linha("Equipamento", solicitacao.equipamento_nome);
  linha("Vínculo", solicitacao.preventiva_id || solicitacao.os_id || solicitacao.demanda_id ? `Prev:${solicitacao.preventiva_id || "-"} OS:${solicitacao.os_id || "-"} Demanda:${solicitacao.demanda_id || "-"}` : "-");
  linha("Descrição", solicitacao.descricao);
  linha("Status", `${solicitacao.status} ${solicitacao.cotacao_inicio_em ? `(cotação: ${fmtBR(solicitacao.cotacao_inicio_em)})` : ""}`);

  y += 6;
  doc.rect(40, y, 515, 20).strokeColor("#e5e7eb").stroke();
  doc.fontSize(9).font("Helvetica-Bold").text("Item", 44, y + 6).text("Descrição", 180, y + 6).text("Un", 370, y + 6).text("Qtde", 410, y + 6).text("Obs", 460, y + 6);
  y += 22;
  doc.font("Helvetica");
  solicitacao.itens.forEach((it) => {
    doc.rect(40, y, 515, 20).strokeColor("#e5e7eb").stroke();
    doc.text(it.item_nome || "-", 44, y + 6, { width: 130 }).text(it.item_descricao || "-", 180, y + 6, { width: 180 }).text(it.unidade || "UN", 370, y + 6).text(String(it.qtd_solicitada || 0), 410, y + 6).text(it.observacao_item || "", 460, y + 6, { width: 90 });
    y += 20;
  });

  y += 30;
  doc.text("Compras ____________________", 40, y).text("Solicitante ____________________", 220, y).text("Almoxarifado ____________________", 400, y);
  y += 28;
  doc.text(`Observações gerais: ${solicitacao.observacoes_compras || ""}`, 40, y);
  doc.end();
}

module.exports = { listSolicitacoes, getSolicitacao, assumirSolicitacao, atualizarDados, marcarComprada, gerarPdf };
