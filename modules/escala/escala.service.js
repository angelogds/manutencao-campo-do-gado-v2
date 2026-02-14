
const db = require("../../database/db");

// pega segunda-feira da semana (YYYY-MM-DD) baseado no TZ do SQLite (usando date('now','localtime'))
function getCurrentWeekRange() {
  // segunda = 1.. domingo = 0 no strftime('%w')
  const row = db.prepare(`
    SELECT
      date('now','localtime') as today,
      date('now','localtime', '-' || ((strftime('%w','now','localtime') + 6) % 7) || ' days') as monday,
      date('now','localtime', '+' || (6 - ((strftime('%w','now','localtime') + 6) % 7)) || ' days') as sunday
  `).get();
  return { monday: row.monday, sunday: row.sunday, today: row.today };
}

function getWeekRangeFromDate(yyyy_mm_dd) {
  const row = db.prepare(`
    SELECT
      date(?,'-' || ((strftime('%w',?) + 6) % 7) || ' days') as monday,
      date(?,'+' || (6 - ((strftime('%w',?) + 6) % 7)) || ' days') as sunday
  `).get(yyyy_mm_dd, yyyy_mm_dd, yyyy_mm_dd, yyyy_mm_dd);
  return { monday: row.monday, sunday: row.sunday };
}

function listColaboradoresAtivos() {
  return db.prepare(`
    SELECT id, nome, funcao, user_id
    FROM colaboradores
    WHERE ativo = 1
    ORDER BY nome
  `).all();
}

function getSemanaByRange(monday, sunday) {
  return db.prepare(`
    SELECT s.*
    FROM escala_semanas s
    WHERE s.data_inicio = ? AND s.data_fim = ?
    LIMIT 1
  `).get(monday, sunday);
}

// cria período+semana automaticamente se não existir
function ensureSemana(monday, sunday) {
  let semana = getSemanaByRange(monday, sunday);
  if (semana) return semana;

  // cria periodo "Semana Atual" (simples)
  const periodoTitulo = `Escala ${monday} a ${sunday}`;
  const insertPeriodo = db.prepare(`
    INSERT INTO escala_periodos (titulo, vigencia_inicio, vigencia_fim, regra_texto, intervalo_tecnico)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertSemana = db.prepare(`
    INSERT INTO escala_semanas (periodo_id, semana_numero, data_inicio, data_fim)
    VALUES (?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    const p = insertPeriodo.run(
      periodoTitulo,
      monday,
      sunday,
      "Escala semanal - Campo do Gado",
      "07:00–17:00 / 19:00–05:00"
    );
    const periodoId = Number(p.lastInsertRowid);
    const w = insertSemana.run(periodoId, 1, monday, sunday);
    const semanaId = Number(w.lastInsertRowid);
    semana = db.prepare(`SELECT * FROM escala_semanas WHERE id = ?`).get(semanaId);
  });

  tx();
  return semana;
}

function listAlocacoesSemana(semanaId) {
  return db.prepare(`
    SELECT a.id, a.tipo_turno, a.horario_inicio, a.horario_fim, a.observacao,
           c.id AS colaborador_id, c.nome AS colaborador_nome, c.funcao AS colaborador_funcao
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
      c.nome
  `).all(semanaId);
}

function createAlocacao({ semana_id, tipo_turno, horario_inicio, horario_fim, colaborador_id, observacao }) {
  const stmt = db.prepare(`
    INSERT INTO escala_alocacoes (semana_id, tipo_turno, horario_inicio, horario_fim, colaborador_id, observacao)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const r = stmt.run(
    Number(semana_id),
    String(tipo_turno || "").trim(),
    String(horario_inicio || "").trim(),
    String(horario_fim || "").trim(),
    Number(colaborador_id),
    String(observacao || "").trim()
  );
  return Number(r.lastInsertRowid);
}

function getPlantaoAgora() {
  const { monday, sunday, today } = getCurrentWeekRange();
  const semana = getSemanaByRange(monday, sunday);
  if (!semana) return { today, items: [] };

  // “agora”: pega todos os turnos do tipo plantao / noturno / diurno / apoio (da semana)
  const items = db.prepare(`
    SELECT a.tipo_turno, a.horario_inicio, a.horario_fim, c.nome, c.funcao
    FROM escala_alocacoes a
    JOIN colaboradores c ON c.id = a.colaborador_id
    WHERE a.semana_id = ?
      AND a.tipo_turno IN ('plantao','noturno','diurno','apoio')
    ORDER BY a.tipo_turno, c.nome
  `).all(semana.id);

  return { today, items, semana };
}

module.exports = {
  getCurrentWeekRange,
  getWeekRangeFromDate,
  ensureSemana,
  listColaboradoresAtivos,
  listAlocacoesSemana,
  createAlocacao,
  getPlantaoAgora,
};
