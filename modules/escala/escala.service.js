const db = require("../../database/db");

// ---------- helpers ----------
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

// ---------- publicações (tabela já existe pela 063) ----------
function getPublicacoes() {
  // Se sua tabela tiver nome diferente, ajuste aqui:
  // na sua migration 063_escala_publicacoes.sql provavelmente é "escala_publicacoes"
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

// ---------- semana por data ----------
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

// lista “linhas” da semana (um por colaborador) + status (folga/atestado)
function getLinhasSemanaComStatus(semanaId) {
  const semana = db.prepare(`
    SELECT id, data_inicio, data_fim
    FROM escala_semanas
    WHERE id=?
  `).get(semanaId);

  if (!semana) return [];

  const alocs = db.prepare(`
    SELECT a.id AS alocacao_id, a.tipo_turno, a.observacao,
           c.id AS colaborador_id, c.nome
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

  // ausências que pegam a semana
  const ausencias = db.prepare(`
    SELECT x.id, x.colaborador_id, x.tipo, x.data_inicio, x.data_fim, x.motivo
    FROM escala_ausencias x
    WHERE NOT (x.data_fim < ? OR x.data_inicio > ?)
  `).all(semana.data_inicio, semana.data_fim);

  const mapAus = new Map();
  for (const a of ausencias) {
    // se tiver mais de uma, guarda a primeira (pode evoluir depois)
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
      statusLabel,
    };
  });
}

// ---------- semana por id ----------
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

// ---------- editar turno ----------
function atualizarTurno(alocacaoId, tipo_turno) {
  db.prepare(`
    UPDATE escala_alocacoes
    SET tipo_turno=?
    WHERE id=?
  `).run(tipo_turno, alocacaoId);
}

// ---------- escala completa ----------
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

// ---------- adicionar rápido ----------
function ensureColaborador(nome) {
  const n = String(nome || "").trim();
  if (!n) return null;

  let row = db.prepare(`SELECT id FROM colaboradores WHERE lower(nome)=lower(?) LIMIT 1`).get(n);
  if (row) return row.id;

  const info = db.prepare(`
    INSERT INTO colaboradores (nome, funcao, ativo)
    VALUES (?, 'mecanico', 1)
  `).run(n);

  return Number(info.lastInsertRowid);
}

function adicionarRapido({ date, nome, tipo_turno, setor }) {
  const d = String(date || isoToday()).slice(0, 10);

  const semana = db.prepare(`
    SELECT id
    FROM escala_semanas
    WHERE ? BETWEEN data_inicio AND data_fim
    LIMIT 1
  `).get(d);

  if (!semana) throw new Error("Não existe semana cadastrada para essa data.");

  const colabId = ensureColaborador(nome);
  if (!colabId) throw new Error("Colaborador inválido.");

  // evita duplicar por semana/turno/colab (índice UNIQUE já faz isso)
  try {
    db.prepare(`
      INSERT INTO escala_alocacoes (semana_id, tipo_turno, colaborador_id, observacao)
      VALUES (?, ?, ?, ?)
    `).run(semana.id, tipo_turno, colabId, setor || "Manutenção");
  } catch (e) {
    // se já existe, só atualiza o turno
    const existente = db.prepare(`
      SELECT id FROM escala_alocacoes
      WHERE semana_id=? AND colaborador_id=?
      LIMIT 1
    `).get(semana.id, colabId);

    if (existente?.id) {
      db.prepare(`UPDATE escala_alocacoes SET tipo_turno=? WHERE id=?`).run(tipo_turno, existente.id);
    } else {
      throw e;
    }
  }
}

// ---------- ausências ----------
function lancarAusencia({ nome, tipo, inicio, fim, motivo }) {
  const colabId = ensureColaborador(nome);
  if (!colabId) throw new Error("Colaborador inválido.");

  db.prepare(`
    INSERT INTO escala_ausencias (colaborador_id, tipo, data_inicio, data_fim, motivo)
    VALUES (?, ?, ?, ?, ?)
  `).run(colabId, tipo, inicio, fim, motivo || null);
}

// ---------- semanas no período ----------
function getSemanasNoPeriodo(start, end) {
  return db.prepare(`
    SELECT id, semana_numero, data_inicio, data_fim
    FROM escala_semanas
    WHERE NOT (data_fim < ? OR data_inicio > ?)
    ORDER BY semana_numero ASC
  `).all(start, end);
}

module.exports = {
  getPublicacoes,
  getSemanaPorData,
  getSemanaById,
  atualizarTurno,
  getEscalaCompletaComTimes,
  adicionarRapido,
  lancarAusencia,
  getLinhasSemanaComStatus,
  getSemanasNoPeriodo,
};
