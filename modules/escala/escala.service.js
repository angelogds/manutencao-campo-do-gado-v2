// modules/escala/escala.service.js
const db = require("../../database/db");

// cria tabela se faltar (não quebra)
function ensureTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS escala_lancamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,              -- YYYY-MM-DD
      turno TEXT NOT NULL,             -- dia|noite
      categoria TEXT NOT NULL,         -- mecanico|apoio
      nome TEXT NOT NULL,
      observacao TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_escala_data ON escala_lancamentos(data);
    CREATE INDEX IF NOT EXISTS idx_escala_turno ON escala_lancamentos(turno);
    CREATE INDEX IF NOT EXISTS idx_escala_categoria ON escala_lancamentos(categoria);
  `);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateOrToday(s) {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return todayISO();
}

function create({ data, turno, categoria, nome, observacao }) {
  ensureTables();

  const stmt = db.prepare(`
    INSERT INTO escala_lancamentos (data, turno, categoria, nome, observacao)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(data, turno, categoria, nome, observacao || null);
}

function listRange(startDateISO, days = 7) {
  ensureTables();

  // gera datas no SQL sem depender de libs
  const end = db
    .prepare(`SELECT date(?, '+' || ? || ' day') AS end`)
    .get(startDateISO, Number(days) - 1)?.end;

  const rows = db.prepare(`
    SELECT id, data, turno, categoria, nome, observacao, created_at
    FROM escala_lancamentos
    WHERE data BETWEEN ? AND ?
    ORDER BY data ASC,
             CASE turno WHEN 'dia' THEN 1 ELSE 2 END,
             CASE categoria WHEN 'mecanico' THEN 1 ELSE 2 END,
             nome ASC
  `).all(startDateISO, end);

  // agrupa por data (pra render fácil)
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.data)) map.set(r.data, []);
    map.get(r.data).push(r);
  }

  // cria lista de dias completos (mesmo sem lançamentos)
  const out = [];
  for (let i = 0; i < Number(days); i++) {
    const d = db.prepare(`SELECT date(?, '+' || ? || ' day') AS d`).get(startDateISO, i)?.d;
    out.push({ data: d, itens: map.get(d) || [] });
  }

  return out;
}

function getByDate(dateISO) {
  ensureTables();

  const itens = db.prepare(`
    SELECT id, data, turno, categoria, nome, observacao, created_at
    FROM escala_lancamentos
    WHERE data = ?
    ORDER BY
      CASE turno WHEN 'dia' THEN 1 ELSE 2 END,
      CASE categoria WHEN 'mecanico' THEN 1 ELSE 2 END,
      nome ASC
  `).all(dateISO);

  const result = {
    mecanico_dia: [],
    mecanico_noite: [],
    apoio_dia: [],
    apoio_noite: [],
  };

  for (const it of itens) {
    if (it.categoria === "mecanico" && it.turno === "dia") result.mecanico_dia.push(it);
    if (it.categoria === "mecanico" && it.turno === "noite") result.mecanico_noite.push(it);
    if (it.categoria === "apoio" && it.turno === "dia") result.apoio_dia.push(it);
    if (it.categoria === "apoio" && it.turno === "noite") result.apoio_noite.push(it);
  }

  return result;
}

module.exports = {
  ensureTables,
  todayISO,
  parseDateOrToday,
  create,
  listRange,
  getByDate,
};
