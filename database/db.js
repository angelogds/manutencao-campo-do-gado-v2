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

const db = new Database(dbPath);

// pragmas base
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function tableExists(name) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name);
  return !!row;
}

function osHasFKToUsersOld() {
  try {
    const fks = db.prepare(`PRAGMA foreign_key_list(os)`).all();
    return fks.some((fk) => String(fk.table || "").toLowerCase() === "users_old");
  } catch (_e) {
    return false;
  }
}

// ✅ Auto-fix: se a tabela OS referencia users_old e users_old não existe, desliga FKs
try {
  const broken = osHasFKToUsersOld() && !tableExists("users_old");
  if (broken) {
    console.log("⚠️ [db] Detectado FK quebrado: os -> users_old (tabela users_old não existe).");
    console.log("⚠️ [db] Aplicando workaround: PRAGMA foreign_keys = OFF para permitir inserts.");
    db.pragma("foreign_keys = OFF");
  }
} catch (e) {
  console.log("⚠️ [db] Não foi possível checar FK quebrado:", e.message || e);
}

module.exports = db;
