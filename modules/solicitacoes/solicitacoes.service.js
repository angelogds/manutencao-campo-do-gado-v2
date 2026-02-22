// modules/solicitacoes/solicitacoes.service.js
const db = require("../../database/db");

function tableColumns(tableName) {
  try {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name);
  } catch (_e) {
    return [];
  }
}

function resolveCreatedByColumn(cols) {
  // tenta várias possibilidades comuns no teu projeto
  if (cols.includes("created_by")) return "created_by";
  if (cols.includes("criado_por")) return "criado_por";
  if (cols.includes("user_id")) return "user_id";
  if (cols.includes("solicitante_id")) return "solicitante_id";
  return null;
}

function createSolicitacao({ titulo, finalidade, setor, prioridade, itens, createdBy }) {
  const cols = tableColumns("solicitacoes_compra");
  if (!cols.length) throw new Error("Tabela solicitacoes_compra não encontrada.");

  const title = (titulo || "").trim();
  if (!title) throw new Error("Título obrigatório.");

  const fields = [];
  const values = [];

  // campos básicos (só coloca se existir)
  if (cols.includes("titulo")) {
    fields.push("titulo");
    values.push(title);
  }
  if (cols.includes("finalidade")) {
    fields.push("finalidade");
    values.push((finalidade || "").trim() || null);
  }
  if (cols.includes("setor")) {
    fields.push("setor");
    values.push((setor || "").trim() || "MANUTENCAO");
  }
  if (cols.includes("prioridade")) {
    fields.push("prioridade");
    values.push((prioridade || "NORMAL").toUpperCase());
  }

  // created_by (ou equivalente)
  const createdCol = resolveCreatedByColumn(cols);
  if (createdCol) {
    fields.push(createdCol);
    values.push(createdBy ? Number(createdBy) : null);
  }

  // created_at/created_em (se existir)
  if (cols.includes("created_at")) {
    fields.push("created_at");
    values.push(null); // deixa default do banco, se tiver
    // se não tiver default, vamos preencher abaixo
  } else if (cols.includes("criado_em")) {
    fields.push("criado_em");
    values.push(null);
  }

  if (!fields.length) {
    throw new Error("Nenhum campo compatível para inserir em solicitacoes_compra.");
  }

  // remove campos com null “placeholder” se a tabela não tiver default
  // (se tiver default, o SQLite ignora? não: vai gravar NULL; então melhor não incluir se for null)
  const filtered = fields
    .map((f, i) => ({ f, v: values[i] }))
    .filter(({ f, v }) => !(v === null && (f === "created_at" || f === "criado_em")));

  const finalFields = filtered.map((x) => x.f);
  const finalValues = filtered.map((x) => x.v);

  const placeholders = finalFields.map(() => "?").join(", ");
  const sql = `INSERT INTO solicitacoes_compra (${finalFields.join(", ")}) VALUES (${placeholders})`;
  const info = db.prepare(sql).run(...finalValues);

  const solicitacaoId = Number(info.lastInsertRowid);

  // Itens (se existir tabela de itens; se não existir, ignora)
  try {
    const itensCols = tableColumns("solicitacoes_compra_itens");
    if (itensCols.length && Array.isArray(itens) && itens.length) {
      const hasSolicId = itensCols.includes("solicitacao_id");
      const hasDesc = itensCols.includes("descricao") || itensCols.includes("item");
      const descCol = itensCols.includes("descricao") ? "descricao" : (itensCols.includes("item") ? "item" : null);
      const hasQtd = itensCols.includes("quantidade") || itensCols.includes("qtd");
      const qtdCol = itensCols.includes("quantidade") ? "quantidade" : (itensCols.includes("qtd") ? "qtd" : null);
      const hasUn = itensCols.includes("unidade") || itensCols.includes("un");
      const unCol = itensCols.includes("unidade") ? "unidade" : (itensCols.includes("un") ? "un" : null);

      const stmt = db.prepare(
        `INSERT INTO solicitacoes_compra_itens (${[
          hasSolicId ? "solicitacao_id" : null,
          descCol,
          qtdCol,
          unCol,
        ].filter(Boolean).join(", ")}) VALUES (${[
          hasSolicId ? "?" : null,
          descCol ? "?" : null,
          qtdCol ? "?" : null,
          unCol ? "?" : null,
        ].filter(Boolean).join(", ")})`
      );

      for (const it of itens) {
        const desc = String(it.descricao || it.item || "").trim();
        if (!desc) continue;

        const qtd = Number(it.quantidade ?? it.qtd ?? 1) || 1;
        const un = String(it.unidade || it.un || "").trim() || null;

        const params = [];
        if (hasSolicId) params.push(solicitacaoId);
        if (descCol) params.push(desc);
        if (qtdCol) params.push(qtd);
        if (unCol) params.push(un);

        stmt.run(...params);
      }
    }
  } catch (_e) {
    // sem itens, ok
  }

  return solicitacaoId;
}

module.exports = { createSolicitacao };
