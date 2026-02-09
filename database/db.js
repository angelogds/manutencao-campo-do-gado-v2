const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH =
  process.env.DB_PATH ||
  path.join(__dirname, 'db.sqlite');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

module.exports = db;
