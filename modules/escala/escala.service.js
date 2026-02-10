const db = require("../../database/db");

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Regra: pega a semana cujo intervalo engloba hoje
 * e lista alocações por tipo_turno (noturno/diurno/apoio)
 */
function getHoje() {
  const hoje = todayISO();

  try {
    const semana = db.prepare(`
      SELECT s.*
      FROM escala_semanas s
      WHERE date(?) BETWEEN date(s.data_inicio) AND date(s.data_fim)
      ORDER BY s.id DESC
      LIMIT 1
    `).get(hoje);

    if (!semana) {
      return {
        data: hoje,
        semana: null,
        noturno: [],
        diurno: [],
        apoio: [],
        aviso: "Nenhuma semana de escala encontrada para hoje. Cadastre um período/semanas.",
      };
    }

    const alocs = db.prepare(`
      SELECT a.*, c.nome
      FROM escala_alocacoes a
      JOIN colaboradores c ON c.id = a.colaborador_id
      WHERE a.semana_id = ?
      ORDER BY a.tipo_turno, c.nome
    `).all(semana.id);

    const noturno = alocs.filter(a => a.tipo_turno === "noturno");
    const diurno  = alocs.filter(a => a.tipo_turno === "diurno");
    const apoio   = alocs.filter(a => a.tipo_turno === "apoio");

    return { data: hoje, semana, noturno, diurno, apoio, aviso: null };
  } catch (e) {
    return {
      data: hoje,
      semana: null,
      noturno: [],
      diurno: [],
      apoio: [],
      aviso: `Erro ao carregar escala: ${e.message}`,
    };
  }
}

module.exports = { getHoje };
