// database/migrate.js
const fs = require("fs");
const path = require("path");
const db = require("./db");

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function isApplied(filename) {
  const row = db.prepare("SELECT 1 FROM migrations WHERE filename = ?").get(filename);
  return !!row;
}

function markApplied(filename) {
  db.prepare("INSERT INTO migrations (filename) VALUES (?)").run(filename);
}

function tableExists(name) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name);
  return !!row;
}

function columnExists(table, column) {
  if (!tableExists(table)) return false;
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

/**
 * FIX: Se estoque_itens já existe (criada antes) e não tem "categoria",
 * adiciona a coluna ANTES de rodar 080_estoque_core.sql
 */
function ensureEstoqueCategoriaColumn() {
  if (!tableExists("estoque_itens")) return;

  if (!columnExists("estoque_itens", "categoria")) {
    console.log("🛠️ Hotfix: adicionando coluna 'categoria' em estoque_itens...");
    db.exec(`ALTER TABLE estoque_itens ADD COLUMN categoria TEXT NOT NULL DEFAULT 'DIVERSOS';`);
    console.log("✅ Coluna 'categoria' adicionada.");
  }
}

function applyOne(filename) {
  const full = path.join(__dirname, "migrations", filename);
  const sql = fs.readFileSync(full, "utf8");

  try {
    // ✅ antes da 080, garante coluna categoria (corrige banco já existente)
    if (filename === "080_estoque_core.sql") {
      ensureEstoqueCategoriaColumn();
    }

    const tx = db.transaction(() => {
      db.exec(sql);
      markApplied(filename);
    });

    tx();
    console.log(`✔ Migration aplicada: ${filename}`);
  } catch (err) {
    console.error(`❌ Erro na migration: ${filename}`);
    console.error(`📄 Arquivo: ${full}`);
    console.error("🧨 Detalhes do erro:", err?.message || err);
    process.exit(1);
  }
}

function applyMigrations() {
  ensureMigrationsTable();

  const dir = path.join(__dirname, "migrations");
  if (!fs.existsSync(dir)) {
    console.warn("⚠️ Pasta de migrations não existe:", dir);
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  console.log(`🧱 Migrations encontradas (${files.length}):`, files.join(", "));

  for (const f of files) {
    if (isApplied(f)) continue;
    applyOne(f);
  }

  const applied = db.prepare("SELECT filename FROM migrations ORDER BY id").all();
  console.log("📌 Migrations aplicadas:", applied.map((r) => r.filename).join(", "));
}

applyMigrations();
module.exports = { applyMigrations };
