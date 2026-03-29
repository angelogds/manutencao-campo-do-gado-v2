const db = require("../../database/db");

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function getIndicadores() {
  const row = db
    .prepare(`
      SELECT
        SUM(CASE WHEN UPPER(tipo)='PREVENTIVA' AND strftime('%Y-%m', opened_at)=strftime('%Y-%m','now') THEN 1 ELSE 0 END) AS prev_mes,
        SUM(CASE WHEN UPPER(tipo)='CORRETIVA' AND strftime('%Y-%m', opened_at)=strftime('%Y-%m','now') THEN 1 ELSE 0 END) AS corr_mes,
        SUM(CASE WHEN status IN ('ABERTA','ANDAMENTO','PAUSADA') AND datetime(opened_at) < datetime('now','-7 day') THEN 1 ELSE 0 END) AS os_atrasadas,
        SUM(CASE WHEN strftime('%Y-%m', opened_at)=strftime('%Y-%m','now') THEN COALESCE(custo_total,0) ELSE 0 END) AS custo_mes,
        SUM(CASE WHEN UPPER(tipo)='CORRETIVA' AND strftime('%Y-%m', opened_at)=strftime('%Y-%m','now')
                 AND (LOWER(descricao) LIKE '%emerg%' OR LOWER(descricao) LIKE '%parada%') THEN 1 ELSE 0 END) AS paradas_np
      FROM os
    `)
    .get() || {};

  const prev = toNum(row.prev_mes);
  const corr = toNum(row.corr_mes);
  const total = prev + corr;

  const mttr = db
    .prepare(`
      SELECT AVG((julianday(closed_at) - julianday(opened_at)) * 24.0) AS mttr_horas
      FROM os
      WHERE closed_at IS NOT NULL
        AND status IN ('CONCLUIDA','FINALIZADA')
        AND datetime(opened_at) >= datetime('now','-180 day')
    `)
    .get();

  const mtbfRows = db
    .prepare(`
      SELECT equipamento_id, opened_at
      FROM os
      WHERE equipamento_id IS NOT NULL
        AND UPPER(tipo)='CORRETIVA'
        AND datetime(opened_at) >= datetime('now','-180 day')
      ORDER BY equipamento_id, datetime(opened_at)
    `)
    .all();

  let sumGap = 0;
  let countGap = 0;
  const lastByEq = {};
  mtbfRows.forEach((r) => {
    const eq = String(r.equipamento_id);
    if (lastByEq[eq]) {
      const gapDays = (new Date(r.opened_at) - new Date(lastByEq[eq])) / (1000 * 60 * 60 * 24);
      if (Number.isFinite(gapDays) && gapDays >= 0) {
        sumGap += gapDays;
        countGap += 1;
      }
    }
    lastByEq[eq] = r.opened_at;
  });

  return {
    preventiva_qtd_mes: prev,
    corretiva_qtd_mes: corr,
    preventiva_pct_mes: total ? Math.round((prev * 1000) / total) / 10 : 0,
    corretiva_pct_mes: total ? Math.round((corr * 1000) / total) / 10 : 0,
    os_atrasadas: toNum(row.os_atrasadas),
    mtbf_medio_dias: countGap ? Math.round((sumGap / countGap) * 10) / 10 : 0,
    mttr_medio_horas: Math.round(toNum(mttr?.mttr_horas) * 10) / 10,
    custo_manutencao_mes: Math.round(toNum(row.custo_mes) * 100) / 100,
    paradas_nao_planejadas: toNum(row.paradas_np),
  };
}

function listColaboradoresTecnicos() {
  return db
    .prepare(`
      SELECT c.id,
             c.nome,
             UPPER(COALESCE(NULLIF(c.funcao, ''), 'AUXILIAR')) AS funcao,
             c.user_id,
             COALESCE(u.role, '') AS role,
             COALESCE(c.ativo, 1) AS ativo
      FROM colaboradores c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE COALESCE(c.ativo, 1) = 1
      ORDER BY c.nome ASC
    `)
    .all();
}

function getColaboradorResumoTecnico(colaboradorId, { periodoInicio, periodoFim } = {}) {
  const id = Number(colaboradorId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const colaborador = db
    .prepare(`
      SELECT c.id,
             c.nome,
             UPPER(COALESCE(NULLIF(c.funcao, ''), 'AUXILIAR')) AS funcao,
             c.user_id,
             COALESCE(u.role, '') AS role
      FROM colaboradores c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
      LIMIT 1
    `)
    .get(id);

  if (!colaborador) return null;

  const params = [id];
  let dateFilter = "";
  if (periodoInicio) {
    dateFilter += " AND datetime(o.opened_at) >= datetime(?)";
    params.push(`${periodoInicio} 00:00:00`);
  }
  if (periodoFim) {
    dateFilter += " AND datetime(o.opened_at) <= datetime(?)";
    params.push(`${periodoFim} 23:59:59`);
  }

  const baseEquipeSql = `
    SELECT o.id,
           o.equipamento_id,
           COALESCE(e.nome, o.equipamento, o.equipamento_manual, 'Sem equipamento') AS equipamento_nome,
           UPPER(COALESCE(o.status, '')) AS status,
           UPPER(COALESCE(o.tipo, '')) AS tipo,
           o.opened_at,
           o.closed_at,
           COALESCE(o.custo_total, 0) AS custo_total
    FROM os o
    LEFT JOIN equipamentos e ON e.id = o.equipamento_id
    WHERE (o.executor_colaborador_id = ? OR o.auxiliar_colaborador_id = ?)
      ${dateFilter}
  `;

  const osRows = db
    .prepare(`${baseEquipeSql} ORDER BY datetime(o.opened_at) DESC`)
    .all(id, id, ...params.slice(1));

  const resumo = db
    .prepare(`
      SELECT COUNT(*) AS total_os,
             SUM(CASE WHEN UPPER(o.status) IN ('CONCLUIDA','FINALIZADA','FECHADA') THEN 1 ELSE 0 END) AS os_concluidas,
             SUM(CASE WHEN UPPER(o.status) IN ('ABERTA','ANDAMENTO','PAUSADA') THEN 1 ELSE 0 END) AS os_abertas,
             SUM(CASE WHEN UPPER(o.tipo) = 'PREVENTIVA' THEN 1 ELSE 0 END) AS os_preventivas,
             SUM(CASE WHEN UPPER(o.tipo) = 'CORRETIVA' THEN 1 ELSE 0 END) AS os_corretivas,
             ROUND(SUM(COALESCE(o.custo_total, 0)), 2) AS custo_total_os,
             ROUND(AVG(
               CASE
                 WHEN o.closed_at IS NOT NULL THEN (julianday(o.closed_at) - julianday(o.opened_at)) * 24.0
                 ELSE NULL
               END
             ), 2) AS mttr_horas,
             ROUND(SUM(
               CASE
                 WHEN o.closed_at IS NOT NULL THEN (julianday(o.closed_at) - julianday(o.opened_at)) * 24.0
                 ELSE 0
               END
             ), 2) AS horas_total_estimadas,
             SUM(CASE WHEN UPPER(COALESCE(o.tipo,''))='CORRETIVA' AND EXISTS (
               SELECT 1 FROM os prev
               WHERE prev.equipamento_id = o.equipamento_id
                 AND prev.id < o.id
                 AND UPPER(COALESCE(prev.tipo,''))='CORRETIVA'
                 AND julianday(o.opened_at) - julianday(prev.opened_at) <= 30
             ) THEN 1 ELSE 0 END) AS retrabalho_qtd
      FROM os o
      WHERE (o.executor_colaborador_id = ? OR o.auxiliar_colaborador_id = ?)
        ${dateFilter}
    `)
    .get(id, id, ...params.slice(1)) || {};

  const topEquipamentos = db
    .prepare(`
      SELECT COALESCE(e.nome, o.equipamento, o.equipamento_manual, 'Sem equipamento') AS equipamento,
             COUNT(*) AS total_os,
             ROUND(SUM(COALESCE(o.custo_total, 0)), 2) AS custo_total
      FROM os o
      LEFT JOIN equipamentos e ON e.id = o.equipamento_id
      WHERE (o.executor_colaborador_id = ? OR o.auxiliar_colaborador_id = ?)
        ${dateFilter}
      GROUP BY COALESCE(e.nome, o.equipamento, o.equipamento_manual, 'Sem equipamento')
      ORDER BY total_os DESC, custo_total DESC, equipamento ASC
      LIMIT 8
    `)
    .all(id, id, ...params.slice(1));

  let materiais = [];
  if (colaborador.user_id) {
    materiais = db
      .prepare(`
        SELECT COALESCE(i.nome, i.codigo, 'Item sem nome') AS item,
               COUNT(*) AS retiradas,
               ROUND(SUM(COALESCE(ar.quantidade, 0)), 2) AS quantidade_total,
               ROUND(SUM(COALESCE(ar.quantidade, 0) * COALESCE(i.custo_medio, 0)), 2) AS custo_estimado
        FROM almox_retiradas ar
        JOIN estoque_itens i ON i.id = ar.item_id
        WHERE ar.created_by = ?
          ${periodoInicio ? " AND datetime(ar.created_at) >= datetime(?)" : ""}
          ${periodoFim ? " AND datetime(ar.created_at) <= datetime(?)" : ""}
        GROUP BY COALESCE(i.nome, i.codigo, 'Item sem nome')
        ORDER BY quantidade_total DESC, custo_estimado DESC
        LIMIT 10
      `)
      .all(
        Number(colaborador.user_id),
        ...(periodoInicio ? [`${periodoInicio} 00:00:00`] : []),
        ...(periodoFim ? [`${periodoFim} 23:59:59`] : [])
      );
  }

  const timeline = osRows.slice(0, 20).map((item) => ({
    ...item,
    duracao_horas:
      item.closed_at && item.opened_at
        ? Math.round((new Date(item.closed_at) - new Date(item.opened_at)) / 36e5 * 100) / 100
        : null,
  }));

  const produtividade = Number(resumo.horas_total_estimadas || 0) > 0
    ? Math.round((Number(resumo.os_concluidas || 0) / Number(resumo.horas_total_estimadas || 1)) * 100) / 100
    : 0;
  const custoMaoObra = Math.round(Number(resumo.horas_total_estimadas || 0) * 65 * 100) / 100;

  return {
    colaborador,
    resumo: {
      ...resumo,
      produtividade_os_hora: produtividade,
      custo_mao_obra_estimado: custoMaoObra,
    },
    topEquipamentos,
    materiais,
    timeline,
  };
}

function getRankingEquipamentos(limit = 5, meses = 6) {
  return db
    .prepare(`
      SELECT COALESCE(e.nome, o.equipamento, 'Sem equipamento') AS equipamento,
             COUNT(*) AS total_os
      FROM os o
      LEFT JOIN equipamentos e ON e.id = o.equipamento_id
      WHERE datetime(o.opened_at) >= datetime('now', '-' || ? || ' months')
      GROUP BY COALESCE(e.nome, o.equipamento, 'Sem equipamento')
      ORDER BY total_os DESC, equipamento ASC
      LIMIT ?
    `)
    .all(Number(meses) || 6, Number(limit) || 5);
}

function listPlanos({ equipamento_id, setor, tipo_manutencao } = {}) {
  let where = "p.ativo = 1";
  const params = {};

  if (equipamento_id) {
    where += " AND p.equipamento_id = @equipamento_id";
    params.equipamento_id = Number(equipamento_id);
  }
  if (setor) {
    where += " AND e.setor = @setor";
    params.setor = String(setor);
  }
  if (tipo_manutencao) {
    where += " AND p.tipo_manutencao = @tipo";
    params.tipo = String(tipo_manutencao).toUpperCase();
  }

  const rows = db
    .prepare(`
      SELECT p.*, e.nome AS equipamento_nome, e.setor AS equipamento_setor
      FROM pcm_planos p
      JOIN equipamentos e ON e.id = p.equipamento_id
      WHERE ${where}
      ORDER BY datetime(p.proxima_data_prevista) ASC, p.id DESC
    `)
    .all(params);

  return rows.map((r) => {
    const due = r.proxima_data_prevista ? new Date(r.proxima_data_prevista) : null;
    const now = new Date();
    let situacao = "NO_PRAZO";
    if (due) {
      const days = (due - now) / (1000 * 60 * 60 * 24);
      if (days < 0) situacao = "ATRASADO";
      else if (days <= 7) situacao = "PROXIMO_VENCIMENTO";
    }
    return { ...r, situacao };
  });
}

function listFiltros() {
  return {
    equipamentos: db.prepare(`SELECT id, nome, setor FROM equipamentos WHERE ativo=1 ORDER BY nome`).all(),
    setores: db.prepare(`SELECT DISTINCT COALESCE(setor,'') AS setor FROM equipamentos WHERE ativo=1 ORDER BY setor`).all(),
    tipos: ["PREVENTIVA", "INSPECAO", "LUBRIFICACAO", "PREDITIVA"],
  };
}

function createPlano({ equipamento_id, atividade_descricao, tipo_manutencao, frequencia_dias, frequencia_horas, proxima_data_prevista, observacao, created_by }) {
  const info = db
    .prepare(`
      INSERT INTO pcm_planos (equipamento_id, atividade_descricao, tipo_manutencao, frequencia_dias, frequencia_horas, proxima_data_prevista, observacao, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    .run(
      Number(equipamento_id),
      String(atividade_descricao || "").trim(),
      String(tipo_manutencao || "PREVENTIVA").toUpperCase(),
      frequencia_dias ? Number(frequencia_dias) : null,
      frequencia_horas ? Number(frequencia_horas) : null,
      proxima_data_prevista || null,
      observacao || null,
      created_by || null
    );

  return Number(info.lastInsertRowid);
}

function gerarOS(planoId, userId) {
  const plano = db
    .prepare(`SELECT p.*, e.nome AS equipamento_nome FROM pcm_planos p JOIN equipamentos e ON e.id=p.equipamento_id WHERE p.id=?`)
    .get(Number(planoId));
  if (!plano) throw new Error("Plano não encontrado.");

  const descricao = `[PCM-PLANO #${plano.id}] ${plano.atividade_descricao}`;

  const trx = db.transaction(() => {
    const osInfo = db
      .prepare(`
        INSERT INTO os (equipamento, equipamento_id, descricao, tipo, status, opened_by, opened_at)
        VALUES (?, ?, ?, 'PREVENTIVA', 'ABERTA', ?, datetime('now'))
      `)
      .run(plano.equipamento_nome, plano.equipamento_id, descricao, userId || null);

    db.prepare(`
      INSERT INTO pcm_execucoes (plano_id, os_id, tipo_evento, observacao, created_by, created_at)
      VALUES (?, ?, 'GERADA_OS', 'OS preventiva gerada automaticamente', ?, datetime('now'))
    `).run(plano.id, Number(osInfo.lastInsertRowid), userId || null);

    return Number(osInfo.lastInsertRowid);
  });

  return trx();
}

function registrarExecucao(planoId, userId) {
  const plano = db.prepare(`SELECT * FROM pcm_planos WHERE id=?`).get(Number(planoId));
  if (!plano) throw new Error("Plano não encontrado.");

  const os = db
    .prepare(`
      SELECT o.*
      FROM os o
      WHERE o.equipamento_id = ?
        AND UPPER(o.tipo)='PREVENTIVA'
        AND UPPER(o.status) IN ('CONCLUIDA','FINALIZADA')
        AND o.descricao LIKE ?
      ORDER BY datetime(o.closed_at) DESC, o.id DESC
      LIMIT 1
    `)
    .get(plano.equipamento_id, `%[PCM-PLANO #${plano.id}]%`);

  if (!os) throw new Error("Não encontrei OS preventiva concluída vinculada a este plano.");

  const existe = db
    .prepare(`SELECT id FROM pcm_execucoes WHERE plano_id=? AND os_id=? AND tipo_evento='EXECUCAO'`)
    .get(plano.id, os.id);

  if (existe) throw new Error("Esta execução já foi registrada para a OS selecionada.");

  const days = Number(plano.frequencia_dias || 0);
  const nextDateSql = days > 0 ? `datetime('now', '+${days} day')` : "NULL";

  const trx = db.transaction(() => {
    db.prepare(`
      INSERT INTO pcm_execucoes (plano_id, os_id, tipo_evento, observacao, created_by, created_at)
      VALUES (?, ?, 'EXECUCAO', 'Execução registrada via OS concluída', ?, datetime('now'))
    `).run(plano.id, os.id, userId || null);

    db.prepare(`
      UPDATE pcm_planos
      SET ultima_execucao_em = datetime('now'),
          proxima_data_prevista = ${nextDateSql},
          updated_at = datetime('now')
      WHERE id = ?
    `).run(plano.id);
  });

  trx();
  return os.id;
}




function saveCriticidade({ equipamento_id, nivel_criticidade, impacto_producao, impacto_seguranca, impacto_ambiental, custo_parada, observacoes, updated_by }) {
  const equipamentoId = Number(equipamento_id);
  if (!Number.isFinite(equipamentoId) || equipamentoId <= 0) {
    throw new Error('Selecione um equipamento válido para salvar a criticidade.');
  }

  const clamp = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 3;
    return Math.max(1, Math.min(5, Math.round(n)));
  };

  const impactoProducao = clamp(impacto_producao);
  const impactoSeguranca = clamp(impacto_seguranca);
  const impactoAmbiental = clamp(impacto_ambiental);
  const custoParada = clamp(custo_parada);

  const nivel = String(nivel_criticidade || '').trim().toUpperCase();
  const nivelMap = { BAIXA: 2, MEDIA: 3, ALTA: 4, CRITICA: 5 };
  const nivelPeso = nivelMap[nivel] || 3;

  const indice = Number((((impactoProducao + impactoSeguranca + impactoAmbiental + custoParada + nivelPeso) / 5)).toFixed(2));

  db.prepare(`
    INSERT INTO pcm_equipamento_criticidade (
      equipamento_id,
      nivel_criticidade,
      impacto_producao,
      impacto_seguranca,
      impacto_ambiental,
      custo_parada,
      indice_criticidade,
      observacoes,
      updated_by,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(equipamento_id) DO UPDATE SET
      nivel_criticidade=excluded.nivel_criticidade,
      impacto_producao=excluded.impacto_producao,
      impacto_seguranca=excluded.impacto_seguranca,
      impacto_ambiental=excluded.impacto_ambiental,
      custo_parada=excluded.custo_parada,
      indice_criticidade=excluded.indice_criticidade,
      observacoes=excluded.observacoes,
      updated_by=excluded.updated_by,
      updated_at=datetime('now')
  `).run(
    equipamentoId,
    nivel || 'MEDIA',
    impactoProducao,
    impactoSeguranca,
    impactoAmbiental,
    custoParada,
    indice,
    String(observacoes || '').trim() || null,
    updated_by || null
  );

  return { equipamento_id: equipamentoId, indice_criticidade: indice, nivel_criticidade: nivel || 'MEDIA' };
}

function safeAll(sql, params) {
  try {
    const stmt = db.prepare(sql);
    if (Array.isArray(params)) return stmt.all(...params);
    if (params && typeof params === 'object') return stmt.all(params);
    return stmt.all();
  } catch (_e) {
    return [];
  }
}

function getEquipamentos() {
  return safeAll(`SELECT id, COALESCE(tag, codigo, '') AS tag, nome, COALESCE(setor,'') AS setor FROM equipamentos WHERE ativo=1 ORDER BY nome`);
}

function getEquipamentoById(id) {
  if (!id) return null;
  try {
    return db.prepare(`
      SELECT e.id, COALESCE(e.tag, e.codigo, '') AS tag, e.nome, COALESCE(e.setor,'') AS setor,
             COALESCE(c.nivel_criticidade, 'N/D') AS criticidade,
             COALESCE(c.impacto_producao, 3) AS impacto_producao,
             COALESCE(c.impacto_seguranca, 3) AS impacto_seguranca,
             COALESCE(c.impacto_ambiental, 3) AS impacto_ambiental,
             COALESCE(c.custo_parada, 3) AS custo_parada,
             COALESCE(c.indice_criticidade, 3) AS indice_criticidade,
             COALESCE(c.observacoes, '') AS observacoes
      FROM equipamentos e
      LEFT JOIN pcm_equipamento_criticidade c ON c.equipamento_id = e.id
      WHERE e.id = ?
    `).get(Number(id));
  } catch (_e) {
    return db.prepare(`SELECT id, COALESCE(tag, codigo, '') AS tag, nome, COALESCE(setor,'') AS setor FROM equipamentos WHERE id=?`).get(Number(id)) || null;
  }
}

function listBom({ equipamento_id, categoria, busca } = {}) {
  let where = '1=1';
  const params = {};
  if (equipamento_id) { where += ' AND b.equipamento_id=@equipamento_id'; params.equipamento_id = Number(equipamento_id); }
  if (categoria) { where += ' AND UPPER(COALESCE(b.categoria, "")) = UPPER(@categoria)'; params.categoria = String(categoria); }
  if (busca) { where += ' AND (COALESCE(b.codigo_interno,"") LIKE @q OR COALESCE(b.modelo_comercial,"") LIKE @q OR COALESCE(b.descricao_tecnica,"") LIKE @q)'; params.q = `%${busca}%`; }
  return safeAll(`
    SELECT b.*, COALESCE(cfg.peca_critica,0) AS peca_critica
    FROM pcm_bom_itens b
    LEFT JOIN pcm_bom_estoque_config cfg ON cfg.bom_item_id = b.id
    WHERE ${where}
    ORDER BY b.id DESC
  `, params);
}

function listLubrificacao({ equipamento_id, setor } = {}) {
  let where = '1=1';
  const params = {};
  if (equipamento_id) { where += ' AND l.equipamento_id=@equipamento_id'; params.equipamento_id = Number(equipamento_id); }
  if (setor) { where += ' AND COALESCE(e.setor,"")=@setor'; params.setor = String(setor); }
  const rows = safeAll(`
    SELECT l.*, e.nome AS equipamento_nome, e.setor
    FROM pcm_lubrificacao_planos l
    JOIN equipamentos e ON e.id = l.equipamento_id
    WHERE ${where}
    ORDER BY datetime(l.proxima_execucao_em) ASC, l.id DESC
  `, params);
  return rows.map((r) => {
    const dias = Number(r.frequencia_dias || 0);
    const sem = Number(r.frequencia_semanas || 0);
    const mes = Number(r.frequencia_meses || 0);
    const horas = Number(r.frequencia_horas_operacao || 0);
    const freq = dias ? `${dias}d` : sem ? `${sem} sem` : mes ? `${mes} mês` : horas ? `${horas}h op.` : '-';
    let situacao = 'NO_PRAZO';
    if (r.proxima_execucao_em) {
      const diff = (new Date(r.proxima_execucao_em) - new Date()) / 86400000;
      if (diff < 0) situacao = 'ATRASADO';
      else if (diff <= 7) situacao = 'EM_BREVE';
    }
    return { ...r, frequencia_label: freq, situacao };
  });
}

function listPecasCriticas({ tipo, busca, abaixo_minimo } = {}) {
  let where = 'COALESCE(cfg.peca_critica,0)=1';
  const params = {};
  if (tipo) { where += ' AND UPPER(COALESCE(b.categoria,""))=UPPER(@tipo)'; params.tipo = String(tipo); }
  if (busca) { where += ' AND (COALESCE(b.codigo_interno,"") LIKE @q OR COALESCE(b.modelo_comercial,"") LIKE @q OR COALESCE(b.descricao_tecnica,"") LIKE @q)'; params.q = `%${busca}%`; }
  if (abaixo_minimo) {
    where += ' AND COALESCE(ei.quantidade_atual,0) < COALESCE(cfg.estoque_minimo_pcm, ei.estoque_minimo, 0)';
  }
  return safeAll(`
    SELECT b.*, cfg.peca_critica,
           COALESCE(ei.quantidade_atual,0) AS estoque_atual,
           COALESCE(cfg.estoque_minimo_pcm, ei.estoque_minimo, 0) AS estoque_minimo,
           1 AS qtd_equipamentos
    FROM pcm_bom_itens b
    LEFT JOIN pcm_bom_estoque_config cfg ON cfg.bom_item_id = b.id
    LEFT JOIN estoque_itens ei ON ei.id = cfg.estoque_item_id
    WHERE ${where}
    ORDER BY b.id DESC
  `, params);
}

function listBacklogSimples() {
  const osRows = safeAll(`
    SELECT o.id, COALESCE(e.nome, o.equipamento, 'Sem equipamento') AS equipamento,
           UPPER(COALESCE(o.tipo,'CORRETIVA')) AS tipo,
           COALESCE(o.prioridade,'MEDIA') AS prioridade,
           COALESCE(c.nivel_criticidade,'N/D') AS criticidade,
           COALESCE(o.status,'ABERTA') AS status,
           COALESCE(o.opened_at,'') AS data_ref,
           CAST(julianday('now') - julianday(o.opened_at) AS INTEGER) AS atraso
    FROM os o
    LEFT JOIN equipamentos e ON e.id=o.equipamento_id
    LEFT JOIN pcm_equipamento_criticidade c ON c.equipamento_id=o.equipamento_id
    WHERE UPPER(COALESCE(o.status,'')) NOT IN ('CONCLUIDA','FINALIZADA')
    ORDER BY datetime(o.opened_at) ASC
    LIMIT 100
  `);
  return osRows.map((r) => ({ ...r, numero: `OS-${r.id}` }));
}


function registrarFalhaOS({ equipamento_id, descricao, prioridade, created_by }) {
  const equipamentoId = Number(equipamento_id);
  if (!Number.isFinite(equipamentoId) || equipamentoId <= 0) {
    throw new Error('Informe um equipamento para registrar a falha.');
  }

  const equipamento = db.prepare('SELECT id, nome FROM equipamentos WHERE id = ?').get(equipamentoId);
  if (!equipamento) throw new Error('Equipamento não encontrado.');

  const info = db.prepare(`
    INSERT INTO os (equipamento, equipamento_id, descricao, tipo, status, prioridade, opened_by, opened_at)
    VALUES (?, ?, ?, 'CORRETIVA', 'ABERTA', ?, ?, datetime('now'))
  `).run(
    equipamento.nome,
    equipamento.id,
    String(descricao || 'Falha registrada via PCM').trim(),
    String(prioridade || 'ALTA').toUpperCase(),
    created_by || null
  );

  return Number(info.lastInsertRowid);
}

function listOSFalhasPreview({ periodo, equipamento, tipo_falha } = {}) {
  let where = "UPPER(COALESCE(tipo,''))='CORRETIVA'";
  const params = {};

  if (periodo) {
    where += " AND strftime('%Y-%m', opened_at) = @periodo";
    params.periodo = String(periodo);
  }

  if (equipamento) {
    where += " AND UPPER(COALESCE(equipamento, equipamento_manual, '')) LIKE UPPER(@equipamento)";
    params.equipamento = `%${String(equipamento).trim()}%`;
  }

  if (tipo_falha) {
    where += " AND UPPER(COALESCE(descricao, '')) LIKE UPPER(@tipo_falha)";
    params.tipo_falha = `%${String(tipo_falha).trim()}%`;
  }

  return safeAll(`
    SELECT id,
           COALESCE(equipamento, equipamento_manual, 'Sem equipamento') AS equipamento,
           COALESCE(descricao, '-') AS descricao,
           tipo,
           status,
           opened_at
    FROM os
    WHERE ${where}
    ORDER BY datetime(opened_at) DESC
    LIMIT 50
  `, params);
}


function buildOsDateFilter({ periodoInicio, periodoFim, alias = 'o' } = {}) {
  let sql = '';
  const params = [];
  if (periodoInicio) {
    sql += ` AND datetime(${alias}.opened_at) >= datetime(?)`;
    params.push(`${periodoInicio} 00:00:00`);
  }
  if (periodoFim) {
    sql += ` AND datetime(${alias}.opened_at) <= datetime(?)`;
    params.push(`${periodoFim} 23:59:59`);
  }
  return { sql, params };
}

function getResumoVisaoGeral({ periodoInicio, periodoFim } = {}) {
  const filter = buildOsDateFilter({ periodoInicio, periodoFim, alias: 'o' });
  const os = db.prepare(`
    SELECT
      SUM(CASE WHEN UPPER(COALESCE(o.status,'')) IN ('ABERTA','ANDAMENTO','PAUSADA') THEN 1 ELSE 0 END) AS os_abertas,
      SUM(CASE WHEN UPPER(COALESCE(o.status,'')) = 'ANDAMENTO' THEN 1 ELSE 0 END) AS os_andamento,
      SUM(CASE WHEN UPPER(COALESCE(o.status,'')) IN ('CONCLUIDA','FINALIZADA','FECHADA') THEN 1 ELSE 0 END) AS os_concluidas,
      ROUND(SUM(COALESCE(o.custo_total,0)),2) AS custo_total,
      ROUND(SUM(CASE WHEN o.closed_at IS NOT NULL THEN (julianday(o.closed_at)-julianday(o.opened_at))*24.0 ELSE 0 END),2) AS horas_total
    FROM os o
    WHERE 1=1
      ${filter.sql}
  `).get(...filter.params) || {};

  const preventivas = db.prepare(`
    SELECT
      SUM(CASE WHEN UPPER(COALESCE(pe.status,''))='PENDENTE' THEN 1 ELSE 0 END) AS programadas,
      SUM(CASE WHEN UPPER(COALESCE(pe.status,''))='ATRASADA' OR (pe.data_prevista IS NOT NULL AND date(pe.data_prevista) < date('now') AND UPPER(COALESCE(pe.status,'')) <> 'EXECUTADA') THEN 1 ELSE 0 END) AS atrasadas,
      SUM(CASE WHEN UPPER(COALESCE(pe.status,''))='EXECUTADA' THEN 1 ELSE 0 END) AS concluidas
    FROM preventiva_execucoes pe
    WHERE 1=1
      ${periodoInicio ? " AND date(COALESCE(pe.data_executada, pe.data_prevista)) >= date(?)" : ''}
      ${periodoFim ? " AND date(COALESCE(pe.data_executada, pe.data_prevista)) <= date(?)" : ''}
  `).get(...(periodoInicio ? [periodoInicio] : []), ...(periodoFim ? [periodoFim] : [])) || {};

  const materiais = safeAll(`
    SELECT COALESCE(i.nome, i.codigo, 'Item sem nome') AS item,
           ROUND(SUM(COALESCE(ar.quantidade,0)),2) AS quantidade_total
    FROM almox_retiradas ar
    JOIN estoque_itens i ON i.id = ar.item_id
    WHERE 1=1
      ${periodoInicio ? " AND datetime(ar.created_at) >= datetime(?)" : ''}
      ${periodoFim ? " AND datetime(ar.created_at) <= datetime(?)" : ''}
    GROUP BY COALESCE(i.nome, i.codigo, 'Item sem nome')
    ORDER BY quantidade_total DESC
    LIMIT 5
  `, [...(periodoInicio ? [`${periodoInicio} 00:00:00`] : []), ...(periodoFim ? [`${periodoFim} 23:59:59`] : [])]);

  const setores = safeAll(`
    SELECT COALESCE(e.setor, 'Sem setor') AS setor, COUNT(*) AS total_os
    FROM os o
    LEFT JOIN equipamentos e ON e.id = o.equipamento_id
    WHERE 1=1 ${filter.sql}
    GROUP BY COALESCE(e.setor, 'Sem setor')
    ORDER BY total_os DESC, setor ASC
    LIMIT 5
  `, filter.params);

  const alertas = getPendenciasAlertas();

  return {
    os_abertas: toNum(os.os_abertas),
    os_andamento: toNum(os.os_andamento),
    os_concluidas: toNum(os.os_concluidas),
    custo_total: toNum(os.custo_total),
    horas_total: toNum(os.horas_total),
    preventivas_programadas: toNum(preventivas.programadas),
    preventivas_atrasadas: toNum(preventivas.atrasadas),
    preventivas_concluidas: toNum(preventivas.concluidas),
    materiais_top: materiais,
    setores_top: setores,
    alertas,
  };
}

function getEquipamentoResumoTecnico(equipamentoId, { periodoInicio, periodoFim } = {}) {
  const id = Number(equipamentoId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const equipamento = getEquipamentoById(id);
  if (!equipamento) return null;

  const filter = buildOsDateFilter({ periodoInicio, periodoFim, alias: 'o' });
  const params = [id, ...filter.params];

  const resumo = db.prepare(`
    SELECT COUNT(*) AS total_intervencoes,
           ROUND(SUM(COALESCE(o.custo_total,0)),2) AS custo_acumulado,
           ROUND(AVG(CASE WHEN o.closed_at IS NOT NULL THEN (julianday(o.closed_at)-julianday(o.opened_at))*24.0 END),2) AS tempo_medio_reparo,
           SUM(CASE WHEN UPPER(COALESCE(o.tipo,''))='PREVENTIVA' THEN 1 ELSE 0 END) AS preventivas_executadas
    FROM os o
    WHERE o.equipamento_id = ?
    ${filter.sql}
  `).get(...params) || {};

  const ultimasOs = db.prepare(`
    SELECT o.id, o.tipo, o.status, o.opened_at, o.closed_at, COALESCE(o.custo_total,0) AS custo_total,
           COALESCE(c1.nome, u1.nome, '-') AS executor,
           COALESCE(c2.nome, u2.nome, '-') AS auxiliar,
           COALESCE(o.descricao,'') AS descricao
    FROM os o
    LEFT JOIN colaboradores c1 ON c1.id = o.executor_colaborador_id
    LEFT JOIN users u1 ON u1.id = o.opened_by
    LEFT JOIN colaboradores c2 ON c2.id = o.auxiliar_colaborador_id
    LEFT JOIN users u2 ON u2.id = o.closed_by
    WHERE o.equipamento_id = ?
    ${filter.sql}
    ORDER BY datetime(o.opened_at) DESC, o.id DESC
    LIMIT 12
  `).all(...params);

  const falhasRecorrentes = db.prepare(`
    SELECT TRIM(SUBSTR(COALESCE(o.descricao,'Sem descrição'),1,80)) AS falha,
           COUNT(*) AS ocorrencias
    FROM os o
    WHERE o.equipamento_id = ?
      AND UPPER(COALESCE(o.tipo,''))='CORRETIVA'
      ${filter.sql}
    GROUP BY TRIM(SUBSTR(COALESCE(o.descricao,'Sem descrição'),1,80))
    HAVING COUNT(*) > 0
    ORDER BY ocorrencias DESC, falha ASC
    LIMIT 6
  `).all(...params);

  const materiais = safeAll(`
    SELECT COALESCE(p.peca_descricao, 'Peça sem descrição') AS item,
           ROUND(SUM(COALESCE(p.quantidade,0)),2) AS quantidade_total
    FROM os_pecas_utilizadas p
    JOIN os o ON o.id = p.os_id
    WHERE o.equipamento_id = ?
    ${filter.sql}
    GROUP BY COALESCE(p.peca_descricao, 'Peça sem descrição')
    ORDER BY quantidade_total DESC
    LIMIT 10
  `, params);

  const reincidencia = db.prepare(`
    SELECT COUNT(*) AS total_reincidencia
    FROM os o
    WHERE o.equipamento_id = ?
      AND UPPER(COALESCE(o.tipo,''))='CORRETIVA'
      AND EXISTS (
        SELECT 1 FROM os prev
        WHERE prev.equipamento_id = o.equipamento_id
          AND prev.id < o.id
          AND UPPER(COALESCE(prev.tipo,''))='CORRETIVA'
          AND julianday(o.opened_at) - julianday(prev.opened_at) <= 30
      )
      ${filter.sql}
  `).get(...params);

  return {
    equipamento,
    resumo: {
      ...resumo,
      reincidencia: toNum(reincidencia?.total_reincidencia),
    },
    ultimasOs,
    falhasRecorrentes,
    materiais,
  };
}

function getPainelCustosIndicadores({ periodoInicio, periodoFim, setor, tipoManutencao } = {}) {
  const filter = buildOsDateFilter({ periodoInicio, periodoFim, alias: 'o' });
  let extraSql = filter.sql;
  const params = [...filter.params];

  if (setor) {
    extraSql += " AND COALESCE(e.setor,'') = ?";
    params.push(String(setor));
  }
  if (tipoManutencao) {
    extraSql += " AND UPPER(COALESCE(o.tipo,'')) = ?";
    params.push(String(tipoManutencao).toUpperCase());
  }

  const resumo = db.prepare(`
    SELECT ROUND(SUM(COALESCE(o.custo_total,0)),2) AS custo_total,
           ROUND(SUM(CASE WHEN UPPER(COALESCE(o.tipo,''))='PREVENTIVA' THEN COALESCE(o.custo_total,0) ELSE 0 END),2) AS custo_preventiva,
           ROUND(SUM(CASE WHEN UPPER(COALESCE(o.tipo,''))='CORRETIVA' THEN COALESCE(o.custo_total,0) ELSE 0 END),2) AS custo_corretiva,
           ROUND(SUM(CASE WHEN o.closed_at IS NOT NULL THEN (julianday(o.closed_at)-julianday(o.opened_at))*24.0 ELSE 0 END),2) AS horas_total
    FROM os o
    LEFT JOIN equipamentos e ON e.id = o.equipamento_id
    WHERE 1=1
      ${extraSql}
  `).get(...params) || {};

  const custoPorEquipamento = safeAll(`
    SELECT COALESCE(e.nome, o.equipamento, 'Sem equipamento') AS equipamento,
           ROUND(SUM(COALESCE(o.custo_total,0)),2) AS custo_total,
           COUNT(*) AS total_os
    FROM os o
    LEFT JOIN equipamentos e ON e.id = o.equipamento_id
    WHERE 1=1 ${extraSql}
    GROUP BY COALESCE(e.nome, o.equipamento, 'Sem equipamento')
    ORDER BY custo_total DESC, total_os DESC
    LIMIT 10
  `, params);

  const custoPorColaborador = safeAll(`
    SELECT COALESCE(c.nome, u.nome, 'Sem executor') AS colaborador,
           ROUND(SUM(COALESCE(o.custo_total,0)),2) AS custo_total,
           COUNT(*) AS total_os
    FROM os o
    LEFT JOIN colaboradores c ON c.id = o.executor_colaborador_id
    LEFT JOIN users u ON u.id = o.opened_by
    LEFT JOIN equipamentos e ON e.id = o.equipamento_id
    WHERE 1=1 ${extraSql}
    GROUP BY COALESCE(c.nome, u.nome, 'Sem executor')
    ORDER BY custo_total DESC, total_os DESC
    LIMIT 10
  `, params);

  const custoPorSetor = safeAll(`
    SELECT COALESCE(e.setor, 'Sem setor') AS setor,
           ROUND(SUM(COALESCE(o.custo_total,0)),2) AS custo_total,
           COUNT(*) AS total_os
    FROM os o
    LEFT JOIN equipamentos e ON e.id = o.equipamento_id
    WHERE 1=1 ${extraSql}
    GROUP BY COALESCE(e.setor, 'Sem setor')
    ORDER BY custo_total DESC, total_os DESC
    LIMIT 10
  `, params);

  return { resumo, custoPorEquipamento, custoPorColaborador, custoPorSetor };
}

function getPendenciasAlertas() {
  const osAbertas = safeAll(`
    SELECT o.id, COALESCE(e.nome, o.equipamento, 'Sem equipamento') AS equipamento,
           UPPER(COALESCE(o.status,'')) AS status,
           CAST(julianday('now') - julianday(o.opened_at) AS INTEGER) AS atraso_dias,
           COALESCE(o.prioridade,'MEDIA') AS prioridade
    FROM os o
    LEFT JOIN equipamentos e ON e.id = o.equipamento_id
    WHERE UPPER(COALESCE(o.status,'')) IN ('ABERTA','ANDAMENTO','PAUSADA')
    ORDER BY atraso_dias DESC, datetime(o.opened_at) ASC
    LIMIT 20
  `);

  const preventivasAtrasadas = safeAll(`
    SELECT pe.id, pp.titulo, pe.data_prevista, pe.status,
           COALESCE(e.nome, 'Sem equipamento') AS equipamento
    FROM preventiva_execucoes pe
    JOIN preventiva_planos pp ON pp.id = pe.plano_id
    LEFT JOIN equipamentos e ON e.id = pp.equipamento_id
    WHERE (UPPER(COALESCE(pe.status,''))='ATRASADA'
      OR (pe.data_prevista IS NOT NULL AND date(pe.data_prevista) < date('now') AND UPPER(COALESCE(pe.status,'')) <> 'EXECUTADA'))
    ORDER BY date(pe.data_prevista) ASC
    LIMIT 20
  `);

  const estoqueCritico = safeAll(`
    SELECT COALESCE(i.nome, i.codigo, 'Item') AS item,
           ROUND(COALESCE(i.quantidade_atual,0),2) AS quantidade_atual,
           ROUND(COALESCE(i.estoque_minimo,0),2) AS estoque_minimo
    FROM estoque_itens i
    WHERE COALESCE(i.quantidade_atual,0) < COALESCE(i.estoque_minimo,0)
    ORDER BY (COALESCE(i.estoque_minimo,0) - COALESCE(i.quantidade_atual,0)) DESC
    LIMIT 15
  `);

  return {
    osAbertas,
    preventivasAtrasadas,
    estoqueCritico,
  };
}

module.exports = {
  getIndicadores,
  listColaboradoresTecnicos,
  getColaboradorResumoTecnico,
  getRankingEquipamentos,
  getResumoVisaoGeral,
  getEquipamentoResumoTecnico,
  getPainelCustosIndicadores,
  getPendenciasAlertas,
  listPlanos,
  listFiltros,
  createPlano,
  gerarOS,
  registrarExecucao,
  getEquipamentos,
  getEquipamentoById,
  listBom,
  listLubrificacao,
  listPecasCriticas,
  listBacklogSimples,
  listOSFalhasPreview,
  saveCriticidade,
  registrarFalhaOS,
};
