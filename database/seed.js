// database/seed.js
const bcrypt = require("bcryptjs");
const db = require("./db");

// ======================
// ADMIN
// ======================
function ensureAdmin() {
  const row = db
    .prepare("SELECT id FROM users WHERE email=? LIMIT 1")
    .get("admin@campodogado.local");

  if (row) {
    console.log("✔ Seed: admin já existe");
    return;
  }

  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, 'ADMIN', datetime('now','-3 hours'))
  `).run("Administrador", "admin@campodogado.local", hash);

  console.log("✔ Seed: admin criado (admin@campodogado.local / admin123)");
}

// ======================
// ESCALA 2026 (AUTO)
// ======================
const ESCALA_2026 = [
  { semana: 1,  inicio: "2026-01-05", fim: "2026-01-11", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 2,  inicio: "2026-01-12", fim: "2026-01-18", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 3,  inicio: "2026-01-19", fim: "2026-01-25", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 4,  inicio: "2026-01-26", fim: "2026-02-01", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 5,  inicio: "2026-02-02", fim: "2026-02-08", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 6,  inicio: "2026-02-09", fim: "2026-02-15", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 7,  inicio: "2026-02-16", fim: "2026-02-22", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 8,  inicio: "2026-02-23", fim: "2026-03-01", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 9,  inicio: "2026-03-02", fim: "2026-03-08", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 10, inicio: "2026-03-09", fim: "2026-03-15", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 11, inicio: "2026-03-16", fim: "2026-03-22", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 12, inicio: "2026-03-23", fim: "2026-03-29", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 13, inicio: "2026-03-30", fim: "2026-04-05", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 14, inicio: "2026-04-06", fim: "2026-04-12", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 15, inicio: "2026-04-13", fim: "2026-04-19", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 16, inicio: "2026-04-20", fim: "2026-04-26", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 17, inicio: "2026-04-27", fim: "2026-05-03", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 18, inicio: "2026-05-04", fim: "2026-05-10", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 19, inicio: "2026-05-11", fim: "2026-05-17", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 20, inicio: "2026-05-18", fim: "2026-05-24", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 21, inicio: "2026-05-25", fim: "2026-05-31", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 22, inicio: "2026-06-01", fim: "2026-06-07", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 23, inicio: "2026-06-08", fim: "2026-06-14", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 24, inicio: "2026-06-15", fim: "2026-06-21", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 25, inicio: "2026-06-22", fim: "2026-06-28", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 26, inicio: "2026-06-29", fim: "2026-07-05", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 27, inicio: "2026-07-06", fim: "2026-07-12", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 28, inicio: "2026-07-13", fim: "2026-07-19", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 29, inicio: "2026-07-20", fim: "2026-07-26", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 30, inicio: "2026-07-27", fim: "2026-08-02", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 31, inicio: "2026-08-03", fim: "2026-08-09", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 32, inicio: "2026-08-10", fim: "2026-08-16", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 33, inicio: "2026-08-17", fim: "2026-08-23", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 34, inicio: "2026-08-24", fim: "2026-08-30", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 35, inicio: "2026-08-31", fim: "2026-09-06", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 36, inicio: "2026-09-07", fim: "2026-09-13", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 37, inicio: "2026-09-14", fim: "2026-09-20", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 38, inicio: "2026-09-21", fim: "2026-09-27", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 39, inicio: "2026-09-28", fim: "2026-10-04", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 40, inicio: "2026-10-05", fim: "2026-10-11", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 41, inicio: "2026-10-12", fim: "2026-10-18", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 42, inicio: "2026-10-19", fim: "2026-10-25", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 43, inicio: "2026-10-26", fim: "2026-11-01", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 44, inicio: "2026-11-02", fim: "2026-11-08", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 45, inicio: "2026-11-09", fim: "2026-11-15", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 46, inicio: "2026-11-16", fim: "2026-11-22", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 47, inicio: "2026-11-23", fim: "2026-11-29", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 48, inicio: "2026-11-30", fim: "2026-12-06", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 49, inicio: "2026-12-07", fim: "2026-12-13", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 50, inicio: "2026-12-14", fim: "2026-12-20", noturno: "Salviano", diurno: ["Diogo","Rodolfo"],    apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 51, inicio: "2026-12-21", fim: "2026-12-27", noturno: "Rodolfo",  diurno: ["Diogo","Salviano"],   apoio: ["Emanuel","Luiz","Júnior"] },
  { semana: 52, inicio: "2026-12-28", fim: "2027-01-01", noturno: "Diogo",    diurno: ["Salviano","Rodolfo"], apoio: ["Emanuel","Luiz","Júnior"] },
];

function ensureColaborador(nome, funcao = "mecanico") {
  const n = String(nome || "").trim();
  if (!n) return null;

  let row = db
    .prepare("SELECT id FROM colaboradores WHERE lower(nome)=lower(?) LIMIT 1")
    .get(n);

  if (row?.id) return row.id;

  const r = db
    .prepare("INSERT INTO colaboradores (nome, funcao, ativo) VALUES (?, ?, 1)")
    .run(n, funcao);

  return r.lastInsertRowid;
}

function ensurePeriodo2026() {
  const titulo = "Escala 2026 (Manutenção)";
  let p = db
    .prepare("SELECT id FROM escala_periodos WHERE titulo=? LIMIT 1")
    .get(titulo);

  if (p?.id) return p.id;

  const r = db
    .prepare(`
      INSERT INTO escala_periodos
      (titulo, vigencia_inicio, vigencia_fim, regra_texto, intervalo_tecnico, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    .run(
      titulo,
      "2026-01-05",
      "2027-01-01",
      "Noturno rotativo (Diogo/Salviano/Rodolfo) + 2 diurnos + apoio fixo.",
      "17h–19h"
    );

  return r.lastInsertRowid;
}

function ensureSemana(periodoId, semanaNumero, inicio, fim) {
  let s = db
    .prepare(
      "SELECT id FROM escala_semanas WHERE periodo_id=? AND semana_numero=? LIMIT 1"
    )
    .get(periodoId, semanaNumero);

  if (s?.id) return s.id;

  const r = db
    .prepare(
      "INSERT INTO escala_semanas (periodo_id, semana_numero, data_inicio, data_fim) VALUES (?, ?, ?, ?)"
    )
    .run(periodoId, semanaNumero, inicio, fim);

  return r.lastInsertRowid;
}

function upsertAlocacao(semanaId, tipo, colabId, ini, fim, obs = null) {
  // idempotente: se já existir (UNIQUE semana_id+tipo+colab) ignora
  try {
    db.prepare(
      `
      INSERT INTO escala_alocacoes
      (semana_id, tipo_turno, horario_inicio, horario_fim, colaborador_id, observacao, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `
    ).run(semanaId, tipo, ini || null, fim || null, colabId, obs || null);
  } catch (e) {
    const msg = String(e?.message || "");
    if (!msg.includes("UNIQUE")) throw e;
  }
}

function seedEscala2026() {
  // verifica se tabelas existem (se migração não rodou ainda)
  const hasColab = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='colaboradores' LIMIT 1"
    )
    .get();
  if (!hasColab) {
    console.log("⚠️ Seed escala: tabelas de escala ainda não existem (migrations).");
    return;
  }

  const periodoId = ensurePeriodo2026();

  // colaboradores (função padrão)
  const apoioFixos = ["Emanuel", "Luiz", "Júnior"];
  for (const nome of ["Diogo", "Salviano", "Rodolfo", ...apoioFixos]) {
    ensureColaborador(nome, "mecanico");
  }

  // horários padrão (ajuste se quiser)
  const H = {
    noturno: { ini: "19:00", fim: "05:00" },
    diurno: { ini: "07:00", fim: "17:00" },
    apoio: { ini: "07:00", fim: "17:00" },
  };

  // cria semanas + alocações
  let countSemanas = 0;
  let countAlocs = 0;

  for (const w of ESCALA_2026) {
    const semanaId = ensureSemana(periodoId, w.semana, w.inicio, w.fim);
    countSemanas++;

    // noturno (1)
    const idNot = ensureColaborador(w.noturno, "mecanico");
    if (idNot) {
      upsertAlocacao(semanaId, "noturno", idNot, H.noturno.ini, H.noturno.fim);
      countAlocs++;
    }

    // diurno (2)
    for (const n of (w.diurno || [])) {
      const id = ensureColaborador(n, "mecanico");
      if (id) {
        upsertAlocacao(semanaId, "diurno", id, H.diurno.ini, H.diurno.fim);
        countAlocs++;
      }
    }

    // apoio (3)
    for (const n of (w.apoio || [])) {
      const id = ensureColaborador(n, "mecanico");
      if (id) {
        upsertAlocacao(semanaId, "apoio", id, H.apoio.ini, H.apoio.fim);
        countAlocs++;
      }
    }
  }

  console.log(`✔ Seed escala: período 2026 id=${periodoId}`);
  console.log(`✔ Seed escala: semanas processadas=${countSemanas}`);
  console.log(`✔ Seed escala: alocações tentadas=${countAlocs} (idempotente)`);
}

module.exports = {
  ensureAdmin,
  seedEscala2026,
};
