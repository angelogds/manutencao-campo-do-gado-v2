const fs = require("fs");
const path = require("path");
const db = require("./db");

db.pragma("foreign_keys = ON");

// Controle de migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const migrationsDir = path.join(__dirname, "migrations");
if (!fs.existsSync(migrationsDir)) {
  console.log("[migrate] Pasta database/migrations não encontrada. Pulando.");
  module.exports = {};
  return;
}

// Ordem garantida (001..., 005..., 010..., 060...)
const files = fs.readdirSync(migrationsDir)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort((a, b) => {
    const na = parseInt(a.split("_")[0], 10);
    const nb = parseInt(b.split("_")[0], 10);
    return na - nb;
  });

const already = new Set(
  db.prepare("SELECT filename FROM migrations").all().map(r => r.filename)
);

const mark = db.prepare("INSERT INTO migrations (filename) VALUES (?)");

const tx = db.transaction((filename, sql) => {
  db.exec(sql);
  mark.run(filename);
});

let ran = 0;
for (const file of files) {
  if (already.has(file)) continue;

  console.log(`[migrate] Aplicando ${file}...`);
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  tx(file, sql);
  ran++;
}

console.log(`[migrate] OK. Novas migrations aplicadas: ${ran}.`);

module.exports = {};
