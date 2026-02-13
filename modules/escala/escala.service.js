const db = require("../../database/db");

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function getSemanaAtual() {
  const hoje = hojeISO();

  const semana = db.prepare(`
    SELECT id, semana_numero, data_inicio, data_fim
    FROM escala_semanas
    WHERE ? BETWEEN data_inicio AND data_fim
    LIMIT 1
  `).get(hoje);

  if (!semana) return null;

  const alocs = db.prepare(`
    SELECT a.id, a.tipo_turno, c.nome
    FROM escala_alocacoes a
    JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.semana_id = ?
  `).all(semana.id);

  const times = {
    noturno: [],
    diurno: [],
    apoio: [],
    folga: [],
    plantao: [],
  };

  alocs.forEach((a) => {
    if (!times[a.tipo_turno]) {
      times[a.tipo_turno] = [];
    }
    times[a.tipo_turno].push(a.nome);
  });

  return { ...semana, times };
}

function getSemanaById(id) {
  const semana = db.prepare(`
    SELECT id, semana_numero, data_inicio, data_fim
    FROM escala_semanas
    WHERE id = ?
  `).get(id);

  if (!semana) return null;

  const alocs = db.prepare(`
    SELECT a.id, a.tipo_turno, c.nome, c.id as colaborador_id
    FROM escala_alocacoes a
    JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.semana_id = ?
  `).all(id);

  return { ...semana, alocacoes: alocs || [] };
}

function atualizarTurno(alocacaoId, novoTurno) {
  db.prepare(`
    UPDATE escala_alocacoes
    SET tipo_turno = ?
    WHERE id = ?
  `).run(novoTurno, alocacaoId);
}

function getEscalaCompleta() {
  return db.prepare(`
    SELECT id, semana_numero, data_inicio, data_fim
    FROM escala_semanas
    ORDER BY semana_numero ASC
  `).all();
}

module.exports = {
  getSemanaAtual,
  getSemanaById,
  atualizarTurno,
  getEscalaCompleta,
};
