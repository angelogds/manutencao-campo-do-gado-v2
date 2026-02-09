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

function applyMigrations() {
  ensureMigrationsTable();

  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // IMPORTANTÍSSIMO: ordem

  const applied = getApplied();

  const insert = db.prepare("INSERT INTO migrations (filename) VALUES (?)");

  const tx = db.transaction(() => {
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      db.exec(sql);
      insert.run(file);
      console.log(`✔ Migration aplicada: ${file}`);
    }
  });

  tx();
}

function runSeeds() {
  try {
    require("./seeds/usuarios.seed"); // deve criar admin se faltar
  } catch (e) {
    console.log("⚠️ Seed não executada:", e.message);
  }
}

applyMigrations();
runSeeds();

module.exports = { applyMigrations };
