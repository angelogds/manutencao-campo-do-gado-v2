const db = require("../../database/db");

function tableExists(name) {
  try {
    return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`).get(String(name || ""));
  } catch (_e) {
    return false;
  }
}

function getTableColumns(tableName) {
  try {
    return db.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name);
  } catch (_e) {
    return [];
  }
}

function ensureResponsaveisTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS preventiva_responsaveis_padrao (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mecanico_1_colaborador_id INTEGER NOT NULL,
      mecanico_2_colaborador_id INTEGER NOT NULL,
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      CHECK (mecanico_1_colaborador_id <> mecanico_2_colaborador_id)
    )
  `);
}

function listPlanos() {
  return db.prepare(`
    SELECT p.*,
           e.nome AS equipamento_nome,
           e.codigo AS equipamento_codigo,
           ex.id AS execucao_id,
           ex.status AS execucao_status,
           ex.responsavel AS execucao_responsavel,
           ex.data_prevista AS execucao_data_prevista,
           ex.data_executada AS execucao_data_executada,
           ex.observacao AS execucao_observacao,
           ex.created_at AS execucao_created_at
    FROM preventiva_planos p
    LEFT JOIN equipamentos e ON e.id = p.equipamento_id
    LEFT JOIN preventiva_execucoes ex ON ex.id = (
      SELECT pe2.id
      FROM preventiva_execucoes pe2
      WHERE pe2.plano_id = p.id
      ORDER BY
        CASE pe2.status
          WHEN 'atrasada' THEN 1
          WHEN 'pendente' THEN 2
          WHEN 'executada' THEN 3
          WHEN 'cancelada' THEN 4
          ELSE 9
        END,
        COALESCE(pe2.data_prevista, '9999-12-31') ASC,
        pe2.id DESC
      LIMIT 1
    )
    ORDER BY p.ativo DESC, p.id DESC
  `).all();
}

function listEquipamentosAtivos() {
  return db.prepare(`
    SELECT id, codigo, nome
    FROM equipamentos
    WHERE ativo = 1
    ORDER BY nome
  `).all();
}

function listColaboradoresAtivos() {
  if (!tableExists("colaboradores")) return [];
  const cols = getTableColumns("colaboradores");
  const ativoExpr = cols.includes("ativo") ? "IFNULL(ativo,1)=1" : "1=1";
  const userExpr = cols.includes("user_id") ? "user_id" : "NULL AS user_id";
  const funcaoExpr = cols.includes("funcao") ? "funcao" : "NULL AS funcao";

  return db.prepare(`
    SELECT id, nome, ${userExpr}, ${funcaoExpr}
    FROM colaboradores
    WHERE ${ativoExpr}
    ORDER BY nome COLLATE NOCASE ASC
  `).all();
}

function createPlano(data) {
  const stmt = db.prepare(`
    INSERT INTO preventiva_planos (
      equipamento_id, titulo, frequencia_tipo, frequencia_valor,
      ativo, observacao
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const r = stmt.run(
    data.equipamento_id ? Number(data.equipamento_id) : null,
    String(data.titulo || "").trim(),
    String(data.frequencia_tipo || "mensal").trim(),
    Number(data.frequencia_valor || 1),
    data.ativo ? 1 : 0,
    String(data.observacao || "").trim()
  );

  return Number(r.lastInsertRowid);
}

function getPlanoById(id) {
  return db.prepare(`
    SELECT p.*,
           e.nome AS equipamento_nome,
           e.codigo AS equipamento_codigo,
           e.setor AS equipamento_setor,
           e.tipo AS equipamento_tipo
    FROM preventiva_planos p
    LEFT JOIN equipamentos e ON e.id = p.equipamento_id
    WHERE p.id = ?
    LIMIT 1
  `).get(Number(id));
}

function listExecucoes(planoId) {
  return db.prepare(`
    SELECT *
    FROM preventiva_execucoes
    WHERE plano_id = ?
    ORDER BY
      CASE status
        WHEN 'atrasada' THEN 1
        WHEN 'pendente' THEN 2
        WHEN 'executada' THEN 3
        WHEN 'cancelada' THEN 4
        ELSE 9
      END,
      COALESCE(data_prevista,'9999-12-31') ASC,
      id DESC
  `).all(Number(planoId));
}

function getResponsaveisPadrao() {
  ensureResponsaveisTable();
  if (!tableExists("colaboradores")) return null;

  const row = db.prepare(`
    SELECT p.*,
           c1.nome AS mecanico_1_nome,
           c1.user_id AS mecanico_1_user_id,
           c2.nome AS mecanico_2_nome,
           c2.user_id AS mecanico_2_user_id
    FROM preventiva_responsaveis_padrao p
    LEFT JOIN colaboradores c1 ON c1.id = p.mecanico_1_colaborador_id
    LEFT JOIN colaboradores c2 ON c2.id = p.mecanico_2_colaborador_id
    WHERE p.id = 1
    LIMIT 1
  `).get();

  if (!row) return null;
  return {
    ...row,
    responsavel_label: [row.mecanico_1_nome, row.mecanico_2_nome].filter(Boolean).join(" e "),
  };
}

function getColaboradorAtivo(id) {
  if (!tableExists("colaboradores")) return null;
  const cols = getTableColumns("colaboradores");
  const ativoExpr = cols.includes("ativo") ? "AND IFNULL(ativo,1)=1" : "";
  const userExpr = cols.includes("user_id") ? "user_id" : "NULL AS user_id";
  return db.prepare(`SELECT id, nome, ${userExpr} FROM colaboradores WHERE id = ? ${ativoExpr} LIMIT 1`).get(Number(id));
}

function syncExecucoesPendentes(responsavelLabel) {
  if (!tableExists("preventiva_execucoes")) return 0;
  const cols = getTableColumns("preventiva_execucoes");
  if (!cols.includes("responsavel") || !cols.includes("status")) return 0;

  const dataExecutadaGuard = cols.includes("data_executada") ? "AND data_executada IS NULL" : "";
  const info = db.prepare(`
    UPDATE preventiva_execucoes
    SET responsavel = ?
    WHERE LOWER(COALESCE(status,'')) IN ('pendente','atrasada','programada','agendada','aberta')
      ${dataExecutadaGuard}
  `).run(String(responsavelLabel || ""));

  return Number(info.changes || 0);
}

function syncOSPreventivasAbertas(mecanico1, mecanico2) {
  if (!tableExists("os")) return 0;
  const cols = getTableColumns("os");
  if (!cols.includes("tipo") || !cols.includes("status")) return 0;

  const updates = [];
  const args = [];

  if (cols.includes("executor_colaborador_id")) {
    updates.push("executor_colaborador_id = ?");
    args.push(Number(mecanico1.id));
  }
  if (cols.includes("auxiliar_colaborador_id")) {
    updates.push("auxiliar_colaborador_id = ?");
    args.push(Number(mecanico2.id));
  }
  if (cols.includes("mecanico_user_id")) {
    updates.push("mecanico_user_id = ?");
    args.push(mecanico1.user_id ? Number(mecanico1.user_id) : null);
  }
  if (cols.includes("auxiliar_user_id")) {
    updates.push("auxiliar_user_id = ?");
    args.push(mecanico2.user_id ? Number(mecanico2.user_id) : null);
  }
  if (cols.includes("alocacao_modo")) updates.push("alocacao_modo = 'AUTO'");
  if (cols.includes("alocado_em")) updates.push("alocado_em = datetime('now','localtime')");

  if (!updates.length) return 0;

  let execucaoGuard = "";
  if (tableExists("os_execucoes")) {
    const execCols = getTableColumns("os_execucoes");
    if (execCols.includes("os_id") && execCols.includes("finalizado_em")) {
      execucaoGuard = `
        AND NOT EXISTS (
          SELECT 1
          FROM os_execucoes ex
          WHERE ex.os_id = os.id
            AND ex.finalizado_em IS NULL
        )`;
    }
  }

  const info = db.prepare(`
    UPDATE os
    SET ${updates.join(", ")}
    WHERE UPPER(COALESCE(tipo,'')) = 'PREVENTIVA'
      AND UPPER(COALESCE(status,'')) IN ('ABERTA','AGUARDANDO_EQUIPE','PENDENTE','PROGRAMADA','AGENDADA')
      ${execucaoGuard}
  `).run(...args);

  return Number(info.changes || 0);
}

function saveResponsaveisPadrao({ mecanico1Id, mecanico2Id, updatedBy = null }) {
  ensureResponsaveisTable();

  const id1 = Number(mecanico1Id || 0);
  const id2 = Number(mecanico2Id || 0);
  if (!id1 || !id2) throw new Error("Selecione os dois responsáveis da preventiva.");
  if (id1 === id2) throw new Error("Selecione dois colaboradores diferentes.");

  const mecanico1 = getColaboradorAtivo(id1);
  const mecanico2 = getColaboradorAtivo(id2);
  if (!mecanico1 || !mecanico2) throw new Error("Um dos colaboradores selecionados não está ativo.");

  const responsavelLabel = `${mecanico1.nome} e ${mecanico2.nome}`;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO preventiva_responsaveis_padrao (
        id, mecanico_1_colaborador_id, mecanico_2_colaborador_id, updated_by, updated_at
      ) VALUES (1, ?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(id) DO UPDATE SET
        mecanico_1_colaborador_id = excluded.mecanico_1_colaborador_id,
        mecanico_2_colaborador_id = excluded.mecanico_2_colaborador_id,
        updated_by = excluded.updated_by,
        updated_at = datetime('now','localtime')
    `).run(id1, id2, updatedBy ? Number(updatedBy) : null);

    const execucoesAtualizadas = syncExecucoesPendentes(responsavelLabel);
    const osAtualizadas = syncOSPreventivasAbertas(mecanico1, mecanico2);

    return { execucoesAtualizadas, osAtualizadas };
  });

  const sincronizacao = tx();
  return {
    ...getResponsaveisPadrao(),
    ...sincronizacao,
  };
}

function createExecucao(planoId, data) {
  const configuracao = getResponsaveisPadrao();
  const responsavelInformado = String(data.responsavel || "").trim();
  const responsavelFinal = responsavelInformado || configuracao?.responsavel_label || "";

  const stmt = db.prepare(`
    INSERT INTO preventiva_execucoes (
      plano_id, data_prevista, status, responsavel, observacao
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const r = stmt.run(
    Number(planoId),
    (data.data_prevista || "").trim() || null,
    String(data.status || "pendente").trim(),
    responsavelFinal,
    String(data.observacao || "").trim()
  );

  return Number(r.lastInsertRowid);
}

function updateExecucaoStatus(planoId, execId, status, dataExecutada) {
  const exec = db.prepare(`
    SELECT id FROM preventiva_execucoes
    WHERE id = ? AND plano_id = ?
  `).get(Number(execId), Number(planoId));

  if (!exec) return false;

  const st = String(status || "").trim();

  const stmt = db.prepare(`
    UPDATE preventiva_execucoes
    SET status = ?,
        data_executada = ?
    WHERE id = ? AND plano_id = ?
  `);

  stmt.run(
    st,
    (dataExecutada || "").trim() || null,
    Number(execId),
    Number(planoId)
  );

  return true;
}

module.exports = {
  listPlanos,
  listEquipamentosAtivos,
  listColaboradoresAtivos,
  createPlano,
  getPlanoById,
  listExecucoes,
  getResponsaveisPadrao,
  saveResponsaveisPadrao,
  createExecucao,
  updateExecucaoStatus
};
