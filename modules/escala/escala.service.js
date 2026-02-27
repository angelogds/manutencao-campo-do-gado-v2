const db = require("../../database/db");

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function turnoLabel(tipo_turno) {
  if (tipo_turno === "noturno") return "Noite";
  if (tipo_turno === "diurno") return "Dia";
  if (tipo_turno === "apoio") return "Apoio";
  if (tipo_turno === "folga") return "Folga";
  if (tipo_turno === "plantao") return "Plantão";
  return String(tipo_turno || "-");
}

function normalizeTurno(turno) {
  const t = String(turno || "").trim().toLowerCase();
  if (t === "noite" || t === "noturno") return "noturno";
  if (t === "dia" || t === "diurno") return "diurno";
  if (t === "apoio") return "apoio";
  if (t === "plantao" || t === "plantão") return "plantao";
  if (t === "folga") return "folga";
  return "";
}

function normalizeFuncao(funcao) {
  const f = String(funcao || "").trim().toLowerCase();
  if (f === "mecânico" || f === "mecanico") return "mecanico";
  if (f === "auxiliar") return "auxiliar";
  if (f === "operacional" || f === "apoio") return "operacional";
  return "";
}

function funcaoLabel(funcao) {
  if (funcao === "mecanico") return "Mecânico";
  if (funcao === "auxiliar") return "Auxiliar";
  if (funcao === "operacional") return "Operacional";
  return String(funcao || "-");
}

function eachDateInclusive(start, end, cb) {
  const cursor = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  while (cursor <= endDate) {
    cb(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

function findSemanaByDate(dateISO) {
  return db.prepare(`
    SELECT id, data_inicio, data_fim
    FROM escala_semanas
    WHERE ? BETWEEN data_inicio AND data_fim
    LIMIT 1
  `).get(dateISO);
}

function getPublicacoes() {
  try {
    return db.prepare(`
      SELECT id, titulo, created_at
      FROM escala_publicacoes
      ORDER BY created_at DESC
      LIMIT 50
    `).all();
  } catch (_e) {
    return [];
  }
}

function getSemanaPorData(dateISO) {
  const d = (dateISO || isoToday()).slice(0, 10);

  const semana = db.prepare(`
    SELECT id, semana_numero, data_inicio, data_fim
    FROM escala_semanas
    WHERE ? BETWEEN data_inicio AND data_fim
    LIMIT 1
  `).get(d);

  if (!semana) return null;

  const linhas = getLinhasSemanaComStatus(semana.id);

  return {
    ...semana,
    linhas,
  };
}

function getLinhasSemanaComStatus(semanaId) {
  const semana = db.prepare(`
    SELECT id, data_inicio, data_fim
    FROM escala_semanas
    WHERE id=?
  `).get(semanaId);

  if (!semana) return [];

  const alocs = db.prepare(`
    SELECT a.id AS alocacao_id, a.tipo_turno, a.observacao,
           c.id AS colaborador_id, c.nome, c.funcao
    FROM escala_alocacoes a
    JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.semana_id = ?
    ORDER BY
      CASE a.tipo_turno
        WHEN 'noturno' THEN 1
        WHEN 'diurno' THEN 2
        WHEN 'apoio' THEN 3
        WHEN 'plantao' THEN 4
        WHEN 'folga' THEN 5
        ELSE 9
      END,
      c.nome ASC
  `).all(semanaId);

  const ausencias = db.prepare(`
    SELECT x.id, x.colaborador_id, x.tipo, x.data_inicio, x.data_fim, x.motivo
    FROM escala_ausencias x
    WHERE NOT (x.data_fim < ? OR x.data_inicio > ?)
  `).all(semana.data_inicio, semana.data_fim);

  const mapAus = new Map();
  for (const a of ausencias) {
    if (!mapAus.has(a.colaborador_id)) mapAus.set(a.colaborador_id, a);
  }

  return alocs.map((a) => {
    const aus = mapAus.get(a.colaborador_id);
    const statusLabel = aus
      ? (aus.tipo === "atestado" ? `Atestado (${aus.data_inicio} a ${aus.data_fim})` : `Folga (${aus.data_inicio} a ${aus.data_fim})`)
      : "Trabalhando";

    return {
      alocacao_id: a.alocacao_id,
      colaborador_id: a.colaborador_id,
      nome: a.nome,
      tipo_turno: a.tipo_turno,
      turnoLabel: turnoLabel(a.tipo_turno),
      setor: "Manutenção",
      funcao: normalizeFuncao(a.funcao) || "mecanico",
      funcaoLabel: funcaoLabel(normalizeFuncao(a.funcao) || "mecanico"),
      statusLabel,
      observacao: a.observacao || "",
    };
  });
}

function getSemanaById(id) {
  const semana = db.prepare(`
    SELECT id, semana_numero, data_inicio, data_fim
    FROM escala_semanas
    WHERE id=?
  `).get(id);

  if (!semana) return null;

  const alocacoes = db.prepare(`
    SELECT a.id, a.tipo_turno, a.observacao,
           c.nome, c.id AS colaborador_id
    FROM escala_alocacoes a
    JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.semana_id = ?
    ORDER BY c.nome
  `).all(id);

  return { ...semana, alocacoes };
}

function atualizarTurno(alocacaoId, tipo_turno) {
  db.prepare(`
    UPDATE escala_alocacoes
    SET tipo_turno=?
    WHERE id=?
  `).run(tipo_turno, alocacaoId);
}

function getEscalaCompletaComTimes() {
  const semanas = db.prepare(`
    SELECT s.id, s.semana_numero, s.data_inicio, s.data_fim
    FROM escala_semanas s
    ORDER BY s.semana_numero ASC
  `).all();

  return semanas.map((s) => {
    const alocs = db.prepare(`
      SELECT a.tipo_turno, c.nome
      FROM escala_alocacoes a
      JOIN colaboradores c ON c.id = a.colaborador_id
      WHERE a.semana_id=?
    `).all(s.id);

    const times = { noturno: [], diurno: [], apoio: [] };
    for (const a of alocs) {
      if (times[a.tipo_turno]) times[a.tipo_turno].push(a.nome);
    }

    return { ...s, times };
  });
}

function ensureColaborador(nome, funcao = "mecanico") {
  const n = String(nome || "").trim();
  if (!n) return null;

  const f = normalizeFuncao(funcao) || "mecanico";

  const row = db.prepare(`SELECT id, funcao FROM colaboradores WHERE lower(nome)=lower(?) LIMIT 1`).get(n);
  if (row?.id) {
    if (row.funcao !== f) {
      db.prepare(`UPDATE colaboradores SET funcao=? WHERE id=?`).run(f, row.id);
    }
    return row.id;
  }

  const info = db.prepare(`
    INSERT INTO colaboradores (nome, funcao, ativo)
    VALUES (?, ?, 1)
  `).run(n, f);

  return Number(info.lastInsertRowid);
}

function upsertAlocacaoSemana(semanaId, colabId, tipo_turno) {
  const existente = db.prepare(`
    SELECT id, tipo_turno
    FROM escala_alocacoes
    WHERE semana_id=? AND colaborador_id=?
    ORDER BY id ASC
    LIMIT 1
  `).get(semanaId, colabId);

  if (!existente?.id) {
    db.prepare(`
      INSERT INTO escala_alocacoes (semana_id, tipo_turno, colaborador_id, observacao)
      VALUES (?, ?, ?, ?)
    `).run(semanaId, tipo_turno, colabId, "Manutenção");
    return "inserted";
  }

  if (existente.tipo_turno !== tipo_turno) {
    db.prepare(`UPDATE escala_alocacoes SET tipo_turno=?, observacao=? WHERE id=?`)
      .run(tipo_turno, "Manutenção", existente.id);
    return "updated";
  }

  db.prepare(`UPDATE escala_alocacoes SET observacao=? WHERE id=?`).run("Manutenção", existente.id);
  return "ignored";
}

function adicionarRapidoPeriodo({ inicio, fim, nome, tipo_turno, funcao }) {
  const dataInicio = String(inicio || "").slice(0, 10);
  const dataFim = String(fim || "").slice(0, 10);

  if (!dataInicio || !dataFim) throw new Error("Preencha início e fim.");
  if (dataInicio > dataFim) throw new Error("Data final não pode ser menor que data inicial.");

  const colabId = ensureColaborador(nome, funcao);
  if (!colabId) throw new Error("Colaborador inválido.");

  const semanasAfetadas = new Set();
  let diasSemSemana = 0;

  eachDateInclusive(dataInicio, dataFim, (dia) => {
    const semana = findSemanaByDate(dia);
    if (!semana?.id) {
      diasSemSemana += 1;
      return;
    }
    semanasAfetadas.add(semana.id);
  });

  let inserted = 0;
  let updated = 0;
  let ignored = 0;

  for (const semanaId of semanasAfetadas) {
    const resultado = upsertAlocacaoSemana(semanaId, colabId, tipo_turno);
    if (resultado === "inserted") inserted += 1;
    else if (resultado === "updated") updated += 1;
    else ignored += 1;
  }

  return {
    inserted,
    updated,
    ignored,
    semanasAfetadas: semanasAfetadas.size,
    diasSemSemana,
    inicio: dataInicio,
    fim: dataFim,
  };
}

function lancarAusencia({ nome, tipo, inicio, fim, motivo }) {
  const colabId = ensureColaborador(nome);
  if (!colabId) throw new Error("Colaborador inválido.");

  db.prepare(`
    INSERT INTO escala_ausencias (colaborador_id, tipo, data_inicio, data_fim, motivo)
    VALUES (?, ?, ?, ?, ?)
  `).run(colabId, tipo, inicio, fim, motivo || null);
}

function getSemanasNoPeriodo(start, end) {
  return db.prepare(`
    SELECT id, semana_numero, data_inicio, data_fim
    FROM escala_semanas
    WHERE NOT (data_fim < ? OR data_inicio > ?)
    ORDER BY data_inicio ASC
  `).all(start, end);
}

function getLinhasPeriodo(start, end) {
  const semanas = getSemanasNoPeriodo(start, end);
  const linhas = [];

  for (const semana of semanas) {
    const semanaLinhas = getLinhasSemanaComStatus(semana.id);

    for (const l of semanaLinhas) {
      linhas.push({
        data_inicio: semana.data_inicio,
        data_fim: semana.data_fim,
        nome: l.nome,
        turnoLabel: l.turnoLabel,
        funcaoLabel: l.funcaoLabel,
        statusLabel: l.statusLabel,
        observacao: l.observacao,
      });
    }
  }

  linhas.sort((a, b) => {
    if (a.data_inicio !== b.data_inicio) return a.data_inicio.localeCompare(b.data_inicio);
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  return linhas;
}

function getEscalaSemanalPdfData() {
  const semanas = db.prepare(`
    SELECT s.id, s.semana_numero, s.data_inicio, s.data_fim
    FROM escala_semanas s
    ORDER BY s.data_inicio ASC
  `).all();

  return semanas.map((s) => {
    const linhas = db.prepare(`
      SELECT a.tipo_turno, c.nome, c.funcao
      FROM escala_alocacoes a
      JOIN colaboradores c ON c.id = a.colaborador_id
      WHERE a.semana_id = ?
      ORDER BY c.nome ASC
    `).all(s.id);

    const montarGrupo = () => ({ mecanico: [], auxiliar: [], operacional: [] });
    const grupos = { noturno: montarGrupo(), diurno: montarGrupo(), apoio: montarGrupo() };

    linhas.forEach((l) => {
      const turno = l.tipo_turno === "apoio" ? "apoio" : l.tipo_turno;
      if (!grupos[turno]) return;
      const funcao = normalizeFuncao(l.funcao) || "mecanico";
      const key = funcao === "operacional" ? "operacional" : funcao;
      if (!grupos[turno][key].includes(l.nome)) {
        grupos[turno][key].push(l.nome);
      }
    });

    return {
      semana: s.semana_numero,
      data_inicio: s.data_inicio,
      data_fim: s.data_fim,
      noturno: grupos.noturno,
      diurno: grupos.diurno,
      apoio: grupos.apoio,
    };
  });
}

function getPeriodoCompensacaoData(start, end) {
  const linhas = getLinhasPeriodo(start, end);

  const ausencias = db.prepare(`
    SELECT x.data_inicio, x.data_fim, x.tipo, x.motivo, c.nome AS colaborador
    FROM escala_ausencias x
    JOIN colaboradores c ON c.id = x.colaborador_id
    WHERE NOT (x.data_fim < ? OR x.data_inicio > ?)
    ORDER BY x.data_inicio ASC, c.nome ASC
  `).all(start, end);

  const baseServicos = linhas.map((l) => ({
    data: l.data_inicio,
    dia: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][new Date(`${l.data_inicio}T00:00:00Z`).getUTCDay()],
    descricao: `${l.nome} em ${l.turnoLabel} (${l.funcaoLabel}).`,
  }));

  const compMap = new Map();
  ausencias
    .filter((a) => a.tipo === "folga")
    .forEach((a) => {
      const key = a.colaborador;
      const atual = compMap.get(key) || { colaborador: key, dias: 0 };
      const dias = Math.max(1, Math.floor((new Date(`${a.data_fim}T00:00:00Z`) - new Date(`${a.data_inicio}T00:00:00Z`)) / 86400000) + 1);
      atual.dias += dias;
      compMap.set(key, atual);
    });

  const compensacoes = Array.from(compMap.values()).map((c) => ({
    colaborador: c.colaborador,
    direito: c.dias === 1 ? "direito a 1 (um) dia de folga" : `direito a ${c.dias} dia(s) de folga`,
  }));

  const folgas = ausencias
    .filter((a) => a.tipo === "folga")
    .map((a) => ({
      data: a.data_inicio,
      colaborador: a.colaborador,
      direito: a.motivo ? `${a.motivo}` : "Meio dia de folga",
    }));

  const descricoes = Array.from(new Set(linhas.map((l) => l.observacao).filter(Boolean)));

  return {
    baseServicos,
    compensacoes,
    folgas,
    descricoes,
  };
}

module.exports = {
  getPublicacoes,
  getSemanaPorData,
  getSemanaById,
  atualizarTurno,
  getEscalaCompletaComTimes,
  adicionarRapidoPeriodo,
  lancarAusencia,
  getLinhasSemanaComStatus,
  getSemanasNoPeriodo,
  getLinhasPeriodo,
  getEscalaSemanalPdfData,
  getPeriodoCompensacaoData,
  normalizeTurno,
  normalizeFuncao,
};
