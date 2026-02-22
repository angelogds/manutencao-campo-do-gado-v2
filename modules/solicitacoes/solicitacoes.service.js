// modules/solicitacoes/solicitacoes.service.js
const db = require("../../database/db");

function tableExists(name) {
  try {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(name);
    return !!row;
  } catch (_e) {
    return false;
  }
}

function columnsOf(tableName) {
  try {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name);
  } catch (_e) {
    return [];
  }
}

function hasColumn(tableName, columnName) {
  const cols = columnsOf(tableName);
  return cols.some(
    (c) => String(c || "").toLowerCase() === String(columnName || "").toLowerCase()
  );
}

function resolveCreatedByColumn(cols) {
  if (cols.includes("created_by")) return "created_by";
  if (cols.includes("criado_por")) return "criado_por";
  if (cols.includes("user_id")) return "user_id";
  if (cols.includes("solicitante_id")) return "solicitante_id";
  return null;
}

function resolveCreatedAtColumn(cols) {
  if (cols.includes("created_at")) return "created_at";
  if (cols.includes("criado_em")) return "criado_em";
  return null;
}

function resolveItensTableName() {
  // no teu projeto já apareceu dois padrões
  if (tableExists("solicitacao_itens")) return "solicitacao_itens";
  if (tableExists("solicitacoes_compra_itens")) return "solicitacoes_compra_itens";
  return null;
}

function resolveCotacoesTableName() {
  if (tableExists("solicitacao_cotacoes")) return "solicitacao_cotacoes";
  if (tableExists("solicitacoes_cotacoes")) return "solicitacoes_cotacoes";
  return null;
}

function resolveVinculosTableName() {
  if (tableExists("solicitacao_vinculos")) return "solicitacao_vinculos";
  if (tableExists("solicitacoes_vinculos")) return "solicitacoes_vinculos";
  return null;
}

function listSolicitacoes() {
  // tenta usar o JOIN completo (se existir vinculos); senão lista básico
  const vincTbl = resolveVinculosTableName();
  const hasEquip = tableExists("equipamentos");

  if (vincTbl && hasEquip) {
    return db.prepare(`
      SELECT s.id,
             s.solicitante,
             s.setor,
             s.status,
             s.observacao,
             s.created_at,
             v.tipo_origem,
             v.destino_uso,
             e.nome AS equipamento_nome
      FROM solicitacoes_compra s
      LEFT JOIN ${vincTbl} v ON v.solicitacao_id = s.id
      LEFT JOIN equipamentos e ON e.id = v.equipamento_id
      ORDER BY s.id DESC
    `).all();
  }

  if (vincTbl && !hasEquip) {
    return db.prepare(`
      SELECT s.id,
             s.solicitante,
             s.setor,
             s.status,
             s.observacao,
             s.created_at,
             v.tipo_origem,
             v.destino_uso
      FROM solicitacoes_compra s
      LEFT JOIN ${vincTbl} v ON v.solicitacao_id = s.id
      ORDER BY s.id DESC
    `).all();
  }

  return db.prepare(`
    SELECT s.id, s.solicitante, s.setor, s.status, s.observacao, s.created_at
    FROM solicitacoes_compra s
    ORDER BY s.id DESC
  `).all();
}

function listEquipamentos() {
  if (!tableExists("equipamentos")) return [];
  return db.prepare(`SELECT id, nome FROM equipamentos WHERE ativo = 1 ORDER BY nome`).all();
}

function createSolicitacao({ solicitante, setor, observacao, itens, vinculo, createdBy }) {
  if (!tableExists("solicitacoes_compra")) {
    throw new Error("Tabela solicitacoes_compra não encontrada.");
  }

  const solCols = columnsOf("solicitacoes_compra");
  const createdByCol = resolveCreatedByColumn(solCols);
  const createdAtCol = resolveCreatedAtColumn(solCols);

  const fields = [];
  const values = [];

  // básicos (somente se existirem)
  if (solCols.includes("solicitante")) {
    fields.push("solicitante");
    values.push(String(solicitante || "").trim());
  }

  if (solCols.includes("setor")) {
    fields.push("setor");
    values.push(String(setor || "MANUTENCAO").trim());
  }

  if (solCols.includes("status")) {
    fields.push("status");
    values.push("aberta");
  }

  if (solCols.includes("observacao")) {
    fields.push("observacao");
    values.push(observacao ? String(observacao).trim() : null);
  }

  if (createdByCol) {
    fields.push(createdByCol);
    values.push(createdBy ? Number(createdBy) : null);
  }

  if (createdAtCol) {
    fields.push(createdAtCol);
    values.push("datetime('now')"); // vai entrar como SQL, então tratamos no insert abaixo
  }

  if (!fields.length) {
    throw new Error("Nenhum campo compatível para inserir em solicitacoes_compra.");
  }

  // monta insert (tratando created_at como SQL, não como parametro)
  const placeholders = fields.map((f) => (f === createdAtCol ? values[fields.indexOf(f)] : "?"));
  const sql = `INSERT INTO solicitacoes_compra (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`;

  const params = [];
  for (let i = 0; i < fields.length; i++) {
    if (fields[i] === createdAtCol) continue; // já foi como SQL
    params.push(values[i]);
  }

  const itensTbl = resolveItensTableName();
  const vincTbl = resolveVinculosTableName();

  // prepara inserts de itens/vínculo se existirem
  const insertItem = (() => {
    if (!itensTbl) return null;

    const itCols = columnsOf(itensTbl);
    const hasEspecificacao = itCols.includes("especificacao");
    const hasCreatedAt = itCols.includes("created_at") || itCols.includes("criado_em");
    const createdAtItCol = itCols.includes("created_at") ? "created_at" : (itCols.includes("criado_em") ? "criado_em" : null);

    // colunas que costumam existir
    const cols = [
      "solicitacao_id",
      itCols.includes("item_id") ? "item_id" : null,
      itCols.includes("descricao") ? "descricao" : null,
      hasEspecificacao ? "especificacao" : null,
      itCols.includes("quantidade") ? "quantidade" : (itCols.includes("qtd") ? "qtd" : null),
      itCols.includes("unidade") ? "unidade" : (itCols.includes("un") ? "un" : null),
      hasCreatedAt ? createdAtItCol : null,
    ].filter(Boolean);

    const ph = cols.map((c) => (c === createdAtItCol ? "datetime('now')" : "?"));

    return {
      cols,
      hasEspecificacao,
      qtdCol: cols.includes("quantidade") ? "quantidade" : (cols.includes("qtd") ? "qtd" : null),
      unCol: cols.includes("unidade") ? "unidade" : (cols.includes("un") ? "un" : null),
      stmt: db.prepare(`INSERT INTO ${itensTbl} (${cols.join(", ")}) VALUES (${ph.join(", ")})`),
      createdAtItCol,
    };
  })();

  const insertVinculo = (() => {
    if (!vincTbl) return null;

    const vCols = columnsOf(vincTbl);
    const hasCreatedAt = vCols.includes("created_at") || vCols.includes("criado_em");
    const createdAtVCol = vCols.includes("created_at") ? "created_at" : (vCols.includes("criado_em") ? "criado_em" : null);

    const cols = [
      "solicitacao_id",
      vCols.includes("tipo_origem") ? "tipo_origem" : null,
      vCols.includes("origem_id") ? "origem_id" : null,
      vCols.includes("equipamento_id") ? "equipamento_id" : null,
      vCols.includes("destino_uso") ? "destino_uso" : null,
      hasCreatedAt ? createdAtVCol : null,
    ].filter(Boolean);

    const ph = cols.map((c) => (c === createdAtVCol ? "datetime('now')" : "?"));

    return {
      cols,
      stmt: db.prepare(`INSERT INTO ${vincTbl} (${cols.join(", ")}) VALUES (${ph.join(", ")})`),
      createdAtVCol,
    };
  })();

  return db.transaction(() => {
    const info = db.prepare(sql).run(...params);
    const solicitacaoId = Number(info.lastInsertRowid);

    // itens
    if (insertItem && Array.isArray(itens)) {
      for (const it of itens) {
        const desc = String(it.descricao || "").trim();
        if (!desc) continue;

        const qtd = Number(it.quantidade ?? it.qtd ?? 1) || 1;
        const un = String(it.unidade || it.un || "UN").toUpperCase();

        const values = [];
        for (const col of insertItem.cols) {
          if (col === "solicitacao_id") values.push(solicitacaoId);
          else if (col === "item_id") values.push(it.item_id ? Number(it.item_id) : null);
          else if (col === "descricao") values.push(desc);
          else if (col === "especificacao") values.push(it.especificacao ? String(it.especificacao).trim() : null);
          else if (col === insertItem.qtdCol) values.push(qtd);
          else if (col === insertItem.unCol) values.push(un);
          else if (col === insertItem.createdAtItCol) {
            // vai como SQL datetime('now'), então não entra como param
          }
        }

        // remove valor do createdAtItCol (porque é SQL)
        const finalParams = insertItem.cols
          .filter((c) => c !== insertItem.createdAtItCol)
          .map((c) => {
            const idx = insertItem.cols.indexOf(c);
            return values[idx];
          });

        insertItem.stmt.run(...finalParams);
      }
    }

    // vínculo (se tabela existir)
    if (insertVinculo) {
      const tipo = String(vinculo?.tipo_origem || "AVULSA").toUpperCase();
      const origemId = vinculo?.origem_id ? Number(vinculo.origem_id) : null;
      const equipId = vinculo?.equipamento_id ? Number(vinculo.equipamento_id) : null;
      const destino = vinculo?.destino_uso ? String(vinculo.destino_uso).trim() : null;

      const values = [];
      for (const col of insertVinculo.cols) {
        if (col === "solicitacao_id") values.push(solicitacaoId);
        else if (col === "tipo_origem") values.push(tipo);
        else if (col === "origem_id") values.push(origemId);
        else if (col === "equipamento_id") values.push(equipId);
        else if (col === "destino_uso") values.push(destino);
        else if (col === insertVinculo.createdAtVCol) {
          // datetime('now') como SQL
        }
      }

      const finalParams = insertVinculo.cols
        .filter((c) => c !== insertVinculo.createdAtVCol)
        .map((c) => {
          const idx = insertVinculo.cols.indexOf(c);
          return values[idx];
        });

      insertVinculo.stmt.run(...finalParams);
    }

    return solicitacaoId;
  })();
}

function getSolicitacaoById(id) {
  if (!tableExists("solicitacoes_compra")) return null;

  const vincTbl = resolveVinculosTableName();
  const hasEquip = tableExists("equipamentos");

  let sol = null;

  if (vincTbl && hasEquip) {
    sol = db.prepare(`
      SELECT s.id, s.solicitante, s.setor, s.status, s.observacao, s.created_at,
             v.tipo_origem, v.origem_id, v.destino_uso, v.equipamento_id,
             e.nome AS equipamento_nome
      FROM solicitacoes_compra s
      LEFT JOIN ${vincTbl} v ON v.solicitacao_id = s.id
      LEFT JOIN equipamentos e ON e.id = v.equipamento_id
      WHERE s.id = ?
    `).get(id);
  } else if (vincTbl) {
    sol = db.prepare(`
      SELECT s.id, s.solicitante, s.setor, s.status, s.observacao, s.created_at,
             v.tipo_origem, v.origem_id, v.destino_uso, v.equipamento_id
      FROM solicitacoes_compra s
      LEFT JOIN ${vincTbl} v ON v.solicitacao_id = s.id
      WHERE s.id = ?
    `).get(id);
  } else {
    sol = db.prepare(`
      SELECT s.id, s.solicitante, s.setor, s.status, s.observacao, s.created_at
      FROM solicitacoes_compra s
      WHERE s.id = ?
    `).get(id);
  }

  if (!sol) return null;

  // itens
  const itensTbl = resolveItensTableName();
  let itens = [];
  if (itensTbl) {
    const itCols = columnsOf(itensTbl);
    const hasEspecificacao = itCols.includes("especificacao");
    const descCol = itCols.includes("descricao") ? "descricao" : null;
    const qtdCol = itCols.includes("quantidade") ? "quantidade" : (itCols.includes("qtd") ? "qtd" : null);
    const unCol = itCols.includes("unidade") ? "unidade" : (itCols.includes("un") ? "un" : null);

    // joins de estoque só se existir
    const hasEstoqueItens = tableExists("estoque_itens");
    const hasVW = tableExists("vw_estoque_saldo");

    const baseSelect = `
      SELECT si.id,
             ${itCols.includes("item_id") ? "si.item_id," : "NULL AS item_id,"}
             ${descCol ? `si.${descCol} AS descricao,` : "NULL AS descricao,"}
             ${hasEspecificacao ? "si.especificacao," : "NULL AS especificacao,"}
             ${qtdCol ? `si.${qtdCol} AS quantidade,` : "NULL AS quantidade,"}
             ${unCol ? `si.${unCol} AS unidade` : "NULL AS unidade"}
             ${hasEstoqueItens ? ", ei.codigo AS estoque_codigo, ei.nome AS estoque_nome" : ", NULL AS estoque_codigo, NULL AS estoque_nome"}
             ${hasVW ? ", COALESCE(vs.saldo, 0) AS saldo_atual" : ", 0 AS saldo_atual"}
      FROM ${itensTbl} si
      ${hasEstoqueItens ? "LEFT JOIN estoque_itens ei ON ei.id = si.item_id" : ""}
      ${hasVW ? "LEFT JOIN vw_estoque_saldo vs ON vs.item_id = si.item_id" : ""}
      WHERE si.solicitacao_id = ?
      ORDER BY si.id
    `;

    itens = db.prepare(baseSelect).all(id);
  }

  // cotações
  const cotTbl = resolveCotacoesTableName();
  let cotacoes = [];
  if (cotTbl) {
    cotacoes = db.prepare(`
      SELECT id, fornecedor, valor_total, observacao, anexo_path, created_at
      FROM ${cotTbl}
      WHERE solicitacao_id = ?
      ORDER BY id DESC
    `).all(id);
  }

  return { ...sol, itens, cotacoes };
}

function updateStatus(id, status) {
  if (!tableExists("solicitacoes_compra")) return;
  db.prepare(`UPDATE solicitacoes_compra SET status = ? WHERE id = ?`)
    .run(String(status || "").toLowerCase(), Number(id));
}

function addCotacao(solicitacaoId, { fornecedor, valor_total, observacao, anexo_path }) {
  const cotTbl = resolveCotacoesTableName();
  if (!cotTbl) throw new Error("Tabela de cotações não encontrada.");

  const cols = columnsOf(cotTbl);
  const createdAtCol = resolveCreatedAtColumn(cols);

  const fields = ["solicitacao_id"];
  const placeholders = ["?"];
  const values = [Number(solicitacaoId)];

  if (cols.includes("fornecedor")) { fields.push("fornecedor"); placeholders.push("?"); values.push(fornecedor); }
  if (cols.includes("valor_total")) { fields.push("valor_total"); placeholders.push("?"); values.push(Number(valor_total || 0)); }
  if (cols.includes("observacao")) { fields.push("observacao"); placeholders.push("?"); values.push(observacao || null); }
  if (cols.includes("anexo_path")) { fields.push("anexo_path"); placeholders.push("?"); values.push(anexo_path || null); }
  if (createdAtCol) { fields.push(createdAtCol); placeholders.push("datetime('now')"); }

  const sql = `INSERT INTO ${cotTbl} (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`;
  db.prepare(sql).run(...values);
}

module.exports = {
  listSolicitacoes,
  listEquipamentos,
  createSolicitacao,
  getSolicitacaoById,
  updateStatus,
  addCotacao,
};
