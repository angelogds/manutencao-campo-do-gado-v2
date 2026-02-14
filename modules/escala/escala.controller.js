// modules/escala/escala.controller.js
const db = require("../../database/db");

// helpers
function toISODate(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekISO(date = new Date()) {
  // semana segunda->domingo (Brasil)
  const d = new Date(date);
  const day = d.getDay(); // 0 dom .. 6 sab
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekISO(date = new Date()) {
  const s = startOfWeekISO(date);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

// ========= PUBLICAÇÕES (PDF) =========
function listPublicacoes() {
  const hasTable = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='escala_publicacoes'`
    )
    .get();

  if (!hasTable) return [];

  return db
    .prepare(
      `
      SELECT id, slug, titulo, arquivo_url, ativo, created_at
      FROM escala_publicacoes
      WHERE ativo = 1
      ORDER BY id DESC
    `
    )
    .all();
}

// ========= ITENS SEMANAIS (DB) =========
// ⚠️ Ajuste os nomes conforme seu schema 060_escala.sql / 061_escala_link_user.sql
// Eu deixei genérico e “blindado”.
function listSemana({ inicio, fim }) {
  // tenta várias colunas para compatibilidade
  // - data / dia / data_ref
  // - nome / colaborador / funcionario
  // - turno / periodo
  // - setor
  const cols = db
    .prepare(`PRAGMA table_info(escala_itens)`)
    .all()
    .map((c) => c.name);

  const has = (c) => cols.includes(c);

  if (!cols.length) return [];

  const colData = has("data")
    ? "data"
    : has("dia")
    ? "dia"
    : has("data_ref")
    ? "data_ref"
    : null;

  const colNome = has("colaborador")
    ? "colaborador"
    : has("nome")
    ? "nome"
    : has("funcionario")
    ? "funcionario"
    : null;

  const colTurno = has("turno")
    ? "turno"
    : has("periodo")
    ? "periodo"
    : null;

  const colSetor = has("setor") ? "setor" : null;

  if (!colData) return [];

  const selectParts = [
    `id`,
    `${colData} as data`,
    colNome ? `${colNome} as colaborador` : `NULL as colaborador`,
    colTurno ? `${colTurno} as turno` : `NULL as turno`,
    colSetor ? `${colSetor} as setor` : `NULL as setor`,
  ];

  const sql = `
    SELECT ${selectParts.join(", ")}
    FROM escala_itens
    WHERE date(${colData}) BETWEEN date(?) AND date(?)
    ORDER BY date(${colData}) ASC, id ASC
  `;

  return db.prepare(sql).all(inicio, fim);
}

exports.index = (req, res) => {
  res.locals.activeMenu = "escala";

  const qWeek = String(req.query?.week || "").trim();
  const base = qWeek ? new Date(qWeek) : new Date();

  const ini = startOfWeekISO(base);
  const fim = endOfWeekISO(base);

  const inicioISO = toISODate(ini);
  const fimISO = toISODate(fim);

  const publicacoes = listPublicacoes();
  let semana = [];
  try {
    // se não existir tabela escala_itens, não quebra
    const hasItens = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='escala_itens'`)
      .get();
    if (hasItens) semana = listSemana({ inicio: inicioISO, fim: fimISO });
  } catch (e) {
    console.warn("⚠️ Escala semanal não carregada:", e.message);
  }

  return res.render("escala/index", {
    title: "Escala",
    publicacoes,
    semana,
    week: inicioISO,
    rangeLabel: `${inicioISO} até ${fimISO}`,
  });
};

// (Opcional) Criar item manual — você pode expandir depois.
exports.create = (req, res) => {
  res.locals.activeMenu = "escala";

  try {
    const { data, colaborador, turno, setor } = req.body || {};
    if (!data || !colaborador) {
      req.flash("error", "Informe pelo menos Data e Colaborador.");
      return res.redirect("/escala");
    }

    const cols = db.prepare(`PRAGMA table_info(escala_itens)`).all().map((c) => c.name);
    const has = (c) => cols.includes(c);

    const colData = has("data") ? "data" : has("dia") ? "dia" : "data_ref";
    const colNome = has("colaborador") ? "colaborador" : has("nome") ? "nome" : "funcionario";
    const colTurno = has("turno") ? "turno" : has("periodo") ? "periodo" : null;
    const colSetor = has("setor") ? "setor" : null;

    const fields = [colData, colNome];
    const values = [data, colaborador];

    if (colTurno) {
      fields.push(colTurno);
      values.push(turno || "");
    }
    if (colSetor) {
      fields.push(colSetor);
      values.push(setor || "");
    }

    const placeholders = fields.map(() => "?").join(", ");

    db.prepare(
      `INSERT INTO escala_itens (${fields.join(", ")}) VALUES (${placeholders})`
    ).run(...values);

    req.flash("success", "Item adicionado na escala.");
    return res.redirect("/escala");
  } catch (e) {
    console.error("❌ Escala create:", e);
    req.flash("error", "Erro ao salvar item da escala.");
    return res.redirect("/escala");
  }
};

// Mantive como “stub” para você ligar no seu PDF real depois
exports.pdfSemana = (req, res) => {
  // Se você já tem implementação, pode substituir esta função
  return res.status(200).send("pdfSemana: implementar/ligar no gerador atual.");
};
