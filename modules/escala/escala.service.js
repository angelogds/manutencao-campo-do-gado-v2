// modules/escala/escala.service.js
const db = require("../../database/db");

// =====================
// Helpers de datas (YYYY-MM-DD)
// =====================
function todayISO() {
  // usa data local do servidor; se você já tem utils/date pode adaptar
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getPeriodo2026() {
  return db
    .prepare("SELECT * FROM escala_periodos WHERE titulo=? LIMIT 1")
    .get("Escala 2026 (Manutenção)");
}

function getSemanasComTimes(periodoId) {
  const semanas = db
    .prepare(
      `
      SELECT id, semana_numero, data_inicio, data_fim
      FROM escala_semanas
      WHERE periodo_id=?
      ORDER BY semana_numero ASC
    `
    )
    .all(periodoId);

  const alocs = db
    .prepare(
      `
      SELECT a.semana_id, a.tipo_turno, c.nome
      FROM escala_alocacoes a
      JOIN colaboradores c ON c.id = a.colaborador_id
      JOIN escala_semanas s ON s.id = a.semana_id
      WHERE s.periodo_id=?
      ORDER BY a.semana_id ASC, a.tipo_turno ASC, c.nome ASC
    `
    )
    .all(periodoId);

  const map = new Map();
  for (const s of semanas) {
    map.set(s.id, { noturno: [], diurno: [], apoio: [], plantao: [], folga: [] });
  }

  for (const a of alocs) {
    const bucket = map.get(a.semana_id);
    if (!bucket) continue;
    if (!bucket[a.tipo_turno]) bucket[a.tipo_turno] = [];
    bucket[a.tipo_turno].push(a.nome);
  }

  return semanas.map((s) => ({
    ...s,
    times: map.get(s.id) || { noturno: [], diurno: [], apoio: [], plantao: [], folga: [] },
  }));
}

// =====================
// ✅ Plantão/agora (para o Dashboard)
// =====================
// Retorna a semana atual e quem está em noturno/diurno/apoio naquela semana.
function getPlantaoAgora(refDateISO) {
  const ref = String(refDateISO || todayISO());

  // encontra semana que contém a data
  const semana = db
    .prepare(
      `
      SELECT s.id as semana_id, s.semana_numero, s.data_inicio, s.data_fim, p.titulo as periodo_titulo
      FROM escala_semanas s
      JOIN escala_periodos p ON p.id = s.periodo_id
      WHERE ? BETWEEN s.data_inicio AND s.data_fim
      ORDER BY s.data_inicio DESC
      LIMIT 1
    `
    )
    .get(ref);

  if (!semana) {
    return {
      ok: false,
      date: ref,
      message: "Nenhuma semana encontrada para a data.",
      semana: null,
      times: { noturno: [], diurno: [], apoio: [], plantao: [], folga: [] },
    };
  }

  const alocs = db
    .prepare(
      `
      SELECT a.tipo_turno, c.nome
      FROM escala_alocacoes a
      JOIN colaboradores c ON c.id = a.colaborador_id
      WHERE a.semana_id=?
      ORDER BY a.tipo_turno ASC, c.nome ASC
    `
    )
    .all(semana.semana_id);

  const times = { noturno: [], diurno: [], apoio: [], plantao: [], folga: [] };
  for (const a of alocs) {
    if (!times[a.tipo_turno]) times[a.tipo_turno] = [];
    times[a.tipo_turno].push(a.nome);
  }

  return {
    ok: true,
    date: ref,
    semana: {
      id: semana.semana_id,
      numero: semana.semana_numero,
      inicio: semana.data_inicio,
      fim: semana.data_fim,
      periodo: semana.periodo_titulo,
    },
    times,
  };
}

module.exports = {
  getPeriodo2026,
  getSemanasComTimes,
  getPlantaoAgora, // ✅ agora existe
};
