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
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;
