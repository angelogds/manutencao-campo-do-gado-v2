// database/migrate.js
const fs = require("fs");
const path = require("path");
const db = require("./db");

function getDbPath() {
  // db.js já abre o arquivo; aqui é só pra log
  return process.env.DB_PATH || "(DB_PATH não definido)";
}

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function resetDatabaseIfRequested() {
  const reset = String(process.env.DB_RESET || "").trim();

  if (reset !== "1") return;

  const dbPath = process.env.DB_PATH;

  if (!dbPath) {
    console.warn("⚠️ DB_RESET=1 ignorado: DB_PATH não definido.");
    return;
  }

  try {
    // fecha conexão atual antes de apagar (better-sqlite3)
    db.close();

    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`🧹 DB_RESET=1 -> Banco removido: ${dbPath}`);
    } else {
      console.log(`⚠️ DB_RESET=1 -> Banco não existia: ${dbPath}`);
    }

    // garante que a pasta existe
    ensureDirExists(dbPath);

    // reabrir conexão
    const Database = require("better-sqlite3");
    const reopened = new Database(dbPath);
    reopened.pragma("journal_mode = WAL");
    reopened.pragma("foreign_keys = ON");

    // substitui o handle do db exportado (db.js)
    // (melhor forma: db.js exportar função getDb; mas aqui fazemos fallback seguro)
    // Como não dá pra trocar o export original facilmente,
    // a forma mais robusta é: reiniciar o processo para reabrir db.js do zero.
    console.log("🔁 DB_RESET feito. Reiniciando processo para reabrir conexão limpa...");
    process.exit(0);
  } catch (err) {
    console.error("❌ Falha ao executar DB_RESET:", err);
    process.exit(1);
  }
}

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
  const row = db
    .prepare("SELECT 1 FROM migrations WHERE filename = ?")
    .get(filename);
  return !!row;
}

function markApplied(filename) {
  db.prepare("INSERT INTO migrations (filename) VALUES (?)").run(filename);
}

function applyOne(filename) {
  const full = path.join(__dirname, "migrations", filename);
  const sql = fs.readFileSync(full, "utf8");

  try {
    const tx = db.transaction(() => {
      db.exec(sql);
      markApplied(filename);
    });

    tx();
    console.log(`✔ Migration aplicada: ${filename}`);
  } catch (err) {
    console.error(`❌ Erro na migration: ${filename}`);
    console.error(`📄 Arquivo: ${full}`);
    console.error("🧨 Detalhes do erro:", err && err.message ? err.message : err);

    // dica rápida pro caso clássico
    if (String(err?.message || "").includes("no such column")) {
      console.error("💡 Dica: a migration está referenciando uma coluna que não existe no schema atual.");
      console.error("   Confira ordem/nomes de colunas nas migrations de estoque (080/081/082/058).");
    }

    process.exit(1);
  }
}

function applyMigrations() {
  console.log("🗄️ SQLite DB em:", getDbPath());

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

  console.log(`🧱 Migrations encontradas (${files.length}): ${files.join(", ")}`);

  for (const f of files) {
    if (isApplied(f)) continue;
    applyOne(f);
  }

  const applied = db.prepare("SELECT filename FROM migrations ORDER BY id").all();
  console.log("📌 Migrations aplicadas:", applied.map((r) => r.filename).join(", "));
}

// 1) se pediu reset, faz e reinicia o processo (exit 0)
resetDatabaseIfRequested();

// 2) aplica migrations normalmente
applyMigrations();

module.exports = { applyMigrations };
