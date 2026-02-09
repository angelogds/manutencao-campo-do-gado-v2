const fs = require('fs');
const path = require('path');
const db = require('./db');

// 1️⃣ GARANTIR QUE A TABELA migrations EXISTE
db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    applied_at TEXT NOT NULL
  );
`);

const dir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.sql'))
  .sort();

// 2️⃣ BUSCAR MIGRATIONS JÁ APLICADAS
const applied = new Set(
  db.prepare('SELECT filename FROM migrations').all().map(r => r.filename)
);

// 3️⃣ APLICAR MIGRATIONS PENDENTES
for (const file of files) {
  if (applied.has(file)) continue;

  const sql = fs.readFileSync(path.join(dir, file), 'utf8');

  db.transaction(() => {
    db.exec(sql);
    db.prepare(
      'INSERT INTO migrations (filename, applied_at) VALUES (?, ?)'
    ).run(file, new Date().toISOString());
  })();

  console.log(`✔ Migration aplicada: ${file}`);
}
