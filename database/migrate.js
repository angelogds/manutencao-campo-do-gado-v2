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
  db.prepare("INSERT OR IGNORE INTO migrations (filename) VALUES (?)").run(filename);
}

function applyOne(filename) {
  const full = path.join(__dirname, "migrations", filename);
  const sql = fs.readFileSync(full, "utf8");

  // ✅ Uma transação por arquivo, SEM começar outra dentro
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

  for (const f of files) {
    if (isApplied(f)) continue;
    applyOne(f);
  }

  // ==========================================================
  // ✅ SAFETY: garante tabela motores mesmo se migration foi marcada
  // (resolve "no such table: motores" em deploys onde a 083 foi
  //  marcada mas não criou a tabela, ou banco reiniciado parcial)
  // ==========================================================
  try {
    const hasMotores = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='motores'")
      .get();

    if (!hasMotores) {
      const f = "083_motores.sql";
      const full = path.join(__dirname, "migrations", f);

      if (fs.existsSync(full)) {
        const sql = fs.readFileSync(full, "utf8");
        db.exec(sql);

        // marca como aplicada só pra não ficar tentando sempre
        markApplied(f);

        console.log("✅ SAFETY: 083_motores.sql executada manualmente (tabela motores criada).");
      } else {
        console.warn("⚠️ SAFETY: arquivo 083_motores.sql não encontrado em database/migrations/");
      }
    }
  } catch (e) {
    console.warn("⚠️ SAFETY motores:", e.message);
  }
}

// roda imediatamente
applyMigrations();

module.exports = { applyMigrations };
