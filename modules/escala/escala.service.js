// modules/escala/escala.service.js
const db = require("../../database/db");

function getPeriodo2026() {
  return db
    .prepare("SELECT * FROM escala_periodos WHERE titulo=? LIMIT 1")
    .get("Escala 2026 (Manutenção)");
}

function getSemanasComTimes(periodoId) {
  // Traz semanas + lista de nomes por tipo_turno
  const semanas = db
    .prepare(`
      SELECT id, semana_numero, data_inicio, data_fim
      FROM escala_semanas
      WHERE periodo_id=?
      ORDER BY semana_numero ASC
    `)
    .all(periodoId);

  const alocs = db
    .prepare(`
      SELECT a.semana_id, a.tipo_turno, c.nome
      FROM escala_alocacoes a
      JOIN colaboradores c ON c.id = a.colaborador_id
      JOIN escala_semanas s ON s.id = a.semana_id
      WHERE s.periodo_id=?
      ORDER BY a.semana_id ASC, a.tipo_turno ASC, c.nome ASC
    `)
    .all(periodoId);

  const map = new Map(); // semana_id -> { noturno:[], diurno:[], apoio:[] }
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
    times: map.get(s.id) || { noturno: [], diurno: [], apoio: [] },
  }));
}

module.exports = {
  getPeriodo2026,
  getSemanasComTimes,
};
