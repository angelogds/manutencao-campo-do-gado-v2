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

function getApplied() {
  return new Set(
    db.prepare("SELECT filename FROM migrations").all().map((r) => r.filename)
  );
}

function hasManualTransaction(sql) {
  // detecta BEGIN/COMMIT/ROLLBACK (qualquer variação simples)
  const s = String(sql || "").toUpperCase();
  return (
    s.includes("BEGIN TRANSACTION") ||
    s.includes("BEGIN;") ||
    s.includes("COMMIT") ||
    s.includes("ROLLBACK")
  );
}

function applyOneMigration(file, sql) {
  const insert = db.prepare("INSERT INTO migrations (filename) VALUES (?)");

  // ✅ Se o .sql tiver BEGIN/COMMIT, não podemos rodar dentro de db.transaction()
  // porque vai dar: "cannot start a transaction within a transaction"
  if (hasManualTransaction(sql)) {
    console.warn(
      `⚠️ Migration ${file} contém BEGIN/COMMIT/ROLLBACK. ` +
        `Rodando SEM tx do JS (recomendado remover BEGIN/COMMIT do .sql).`
    );
    db.exec(sql);
    insert.run(file);
    console.log(`✔ Migration aplicada (sem tx JS): ${file}`);
    return;
  }

  // ✅ Caso normal: 1 migration = 1 transação
  const tx = db.transaction(() => {
    db.exec(sql);
    insert.run(file);
  });

  tx();
  console.log(`✔ Migration aplicada: ${file}`);
}

function applyMigrations() {
  ensureMigrationsTable();

  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // ordem

  const applied = getApplied();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    try {
      applyOneMigration(file, sql);
    } catch (err) {
      console.error(`❌ Falha na migration ${file}:`, err.message);
      throw err; // derruba para você ver no log e corrigir
    }
  }
}

function runSeeds() {
  try {
    // opcional: se existir, roda seed
    require("./seeds/usuarios.seed");
  } catch (e) {
    console.log("⚠️ Seed não executada:", e.message);
  }
}

applyMigrations();
runSeeds();

module.exports = { applyMigrations };
