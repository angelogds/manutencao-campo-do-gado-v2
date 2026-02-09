const fs = require('fs');
const path = require('path');
const db = require('./db');

const dir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

const applied = new Set(
  db.prepare('SELECT filename FROM migrations').all().map(r => r.filename)
);

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
