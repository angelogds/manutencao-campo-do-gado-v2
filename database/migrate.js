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

function applyOne(filename) {
  const full = path.join(__dirname, "migrations", filename);
  const sql = fs.readFileSync(full, "utf8");

  const tx = db.transaction(() => {
    db.exec(sql);
    markApplied(filename);
  });

  tx();
  console.log(`✔ Migration aplicada: ${filename}`);
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

  // ✅ Confirma se a 083 foi aplicada
  const applied = db.prepare("SELECT filename FROM migrations ORDER BY id").all();
  console.log("📌 Migrations aplicadas:", applied.map((r) => r.filename).join(", "));
}

applyMigrations();
module.exports = { applyMigrations };
