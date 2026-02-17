// database/db.js
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Railway: use DB_PATH=/data/app.db (com volume montado em /data)
const defaultDevPath = path.join(__dirname, "db.sqlite");
const dbPath = process.env.DB_PATH || defaultDevPath;

// garante pasta existente
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// ✅ RESET CONTROLADO (use DB_RESET=1 só uma vez e depois remova)
if (process.env.DB_RESET === "1") {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`⚠️ DB_RESET=1 -> Banco removido: ${dbPath}`);
    } else {
      console.log(`⚠️ DB_RESET=1 -> Banco não existia: ${dbPath}`);
    }
  } catch (e) {
    console.error("❌ Falha ao resetar DB:", e.message);
  }
}

// ✅ LOG do caminho real do DB (pra matar de vez dúvida de “qual DB está usando”)
console.log("🗄️ SQLite DB em:", dbPath);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;
