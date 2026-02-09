const fs = require("fs");
const path = require("path");
const db = require("./db");

db.pragma("foreign_keys = ON");

// Tabela que registra quais migrations já foram aplicadas
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const migrationsDir = path.join(__dirname, "migrations");

// Se a pasta não existir, não quebra o servidor
if (!fs.existsSync(migrationsDir)) {
  console.log("[migrate] Pasta database/migrations não encontrada. Pulando migrations.");
  module.exports = {};
  return;
}

const files = fs.readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const applied = new Set(
  db.prepare("SELECT filename FROM migrations").all().map((r) => r.filename)
);

const markApplied = db.prepare("INSERT INTO migrations (filename) VALUES (?)");

const runOne = db.transaction((filename, sql) => {
  db.exec(sql);
  markApplied.run(filename);
});

let appliedNow = 0;

for (const file of files) {
  if (applied.has(file)) continue;

  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  console.log(`[migrate] Aplicando ${file}...`);
  runOne(file, sql);
  appliedNow++;
}

console.log(`[migrate] OK. Novas migrations aplicadas: ${appliedNow}.`);

module.exports = {};
