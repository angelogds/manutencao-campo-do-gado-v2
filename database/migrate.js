const fs = require("fs");
const path = require("path");
const db = require("./db"); // ✅ PRIMEIRO importa o db

// ✅ cria a tabela de controle de migrations
db.prepare(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

const migrationsDir = path.join(__dirname, "migrations");

const applied = db
  .prepare("SELECT filename FROM migrations")
  .all()
  .map((m) => m.filename);

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  if (applied.includes(file)) continue;

  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

  db.exec(sql);

  db.prepare("INSERT INTO migrations (filename) VALUES (?)").run(file);

  console.log(`✔ Migration aplicada: ${file}`);
}

// ✅ roda seeds DEPOIS das migrations
const { seedAdminIfMissing } = require("./seeds/usuarios.seed");
seedAdminIfMissing();
