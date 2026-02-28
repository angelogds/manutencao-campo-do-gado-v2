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


function toDateOnly(value) {
  return String(value || "").slice(0, 10);
}

function parseTimeToMinutes(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map((v) => Number(v));
  if (!Number.isInteger(h) || !Number.isInteger(m)) return NaN;
  return (h * 60) + m;
}

function calculateCompensacao(horaInicio, horaFim) {
  const start = parseTimeToMinutes(horaInicio);
  const end = parseTimeToMinutes(horaFim);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Horário inválido para compensação.");
  }

  const minutos = end - start;
  let concessao = "SEM_DIREITO";
  if (minutos >= 240 && minutos < 480) concessao = "MEIA";
  if (minutos >= 480) concessao = "INTEIRA";

  return { minutos, concessao };
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
    SELECT x.colaborador_id, upper(x.tipo) AS tipo, x.data_inicio AS inicio, x.data_fim AS fim
    FROM escala_ausencias x
    WHERE NOT (x.data_fim < ? OR x.data_inicio > ?)
  `).all(semana.data_inicio, semana.data_fim);

  const concessoes = db.prepare(`
    SELECT c.colaborador_id, c.tipo, c.inicio, c.fim
    FROM escala_concessoes c
    WHERE NOT (c.fim < ? OR c.inicio > ?)
  `).all(semana.data_inicio, semana.data_fim);

  const mapAus = new Map();
  for (const a of [...ausencias, ...concessoes]) {
    if (!mapAus.has(a.colaborador_id)) mapAus.set(a.colaborador_id, a);
  }

  return alocs.map((a) => {
    const aus = mapAus.get(a.colaborador_id);
    const statusLabel = aus
      ? `${String(aus.tipo || '').toUpperCase()} (${aus.inicio} a ${aus.fim})`
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


function removerAlocacao(alocacaoId) {
  const info = db.prepare(`DELETE FROM escala_alocacoes WHERE id=?`).run(Number(alocacaoId));
  return info.changes > 0;
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
  const dataInicio = toDateOnly(inicio);
  const dataFim = toDateOnly(fim);

  if (!dataInicio || !dataFim) throw new Error("Preencha início e fim.");
  if (dataInicio > dataFim) throw new Error("Data final não pode ser menor que data inicial.");

  const colabId = ensureColaborador(nome, funcao);
  if (!colabId) throw new Error("Colaborador inválido.");

  db.prepare(`
    INSERT INTO escala_entries (colaborador_id, funcao, turno, inicio, fim)
    VALUES (?, ?, ?, ?, ?)
  `).run(colabId, normalizeFuncao(funcao) || "mecanico", normalizeTurno(tipo_turno), dataInicio, dataFim);

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

function lancarAusencia({
  nome,
  tipo,
  inicio,
  fim,
  motivo,
  dataServico,
  horaInicio,
  horaFim,
  equipamento,
  descricaoServico,
  funcao,
}) {
  const colabId = ensureColaborador(nome, funcao || "mecanico");
  if (!colabId) throw new Error("Colaborador inválido.");

  const tipoUpper = String(tipo || "").trim().toUpperCase();
  const inicioIso = toDateOnly(inicio);
  const fimIso = toDateOnly(fim);

  if (!inicioIso || !fimIso || inicioIso > fimIso) {
    throw new Error("Período inválido para concessão.");
  }

  let concessao = "NAO_APLICA";
  let refCompensacaoId = null;

  if (tipoUpper === "FOLGA" && dataServico && horaInicio && horaFim) {
    const calculo = calculateCompensacao(horaInicio, horaFim);
    concessao = calculo.concessao === "SEM_DIREITO" ? "MEIA" : calculo.concessao;

    const info = db.prepare(`
      INSERT INTO escala_compensacoes (
        colaborador_id, funcao, data_servico, hora_inicio, hora_fim,
        minutos_total, concessao_sugerida, equipamento, descricao_servico
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      colabId,
      normalizeFuncao(funcao) || "mecanico",
      toDateOnly(dataServico),
      horaInicio,
      horaFim,
      calculo.minutos,
      calculo.concessao,
      equipamento || null,
      descricaoServico || null,
    );

    refCompensacaoId = Number(info.lastInsertRowid);
  } else if (tipoUpper === "FOLGA") {
    concessao = "INTEIRA";
  }

  db.prepare(`
    INSERT INTO escala_concessoes (colaborador_id, tipo, inicio, fim, concessao, motivo, ref_compensacao_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(colabId, tipoUpper, inicioIso, fimIso, concessao, motivo || null, refCompensacaoId);

  if (tipoUpper !== "FERIAS") {
    const tipoLegacy = tipoUpper === "ATESTADO" ? "atestado" : "folga";
    db.prepare(`
      INSERT INTO escala_ausencias (colaborador_id, tipo, data_inicio, data_fim, motivo)
      VALUES (?, ?, ?, ?, ?)
    `).run(colabId, tipoLegacy, inicioIso, fimIso, motivo || null);
  }
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
    nome: l.nome,
    turnoFuncao: `${l.turnoLabel} / ${l.funcaoLabel}`,
  }));

  const registros = [];
  for (const ausencia of ausencias) {
    const current = new Date(`${ausencia.data_inicio}T00:00:00Z`);
    const limit = new Date(`${ausencia.data_fim}T00:00:00Z`);

    while (current <= limit) {
      const iso = current.toISOString().slice(0, 10);
      if (iso >= start && iso <= end) {
        registros.push({
          data: iso,
          tipo: ausencia.tipo === "atestado" ? "Atestado" : "Folga",
          colaborador: ausencia.colaborador,
          motivo: ausencia.motivo || "",
        });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  registros.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    return a.colaborador.localeCompare(b.colaborador, "pt-BR");
  });

  return {
    baseServicos,
    registros,
  };
}


module.exports = {
  getPublicacoes,
  getSemanaPorData,
  getSemanaById,
  atualizarTurno,
  removerAlocacao,
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
