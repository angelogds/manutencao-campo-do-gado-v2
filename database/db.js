
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = process.env.DB_PATH && process.env.DB_PATH.length ? process.env.DB_PATH : path.join(__dirname,'db.sqlite');
const db = new Database(dbPath);
db.pragma('foreign_keys=ON');
module.exports = db;
