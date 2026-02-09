const bcrypt = require("bcryptjs");
const db = require("../db");

function seedAdminIfMissing() {
  // ✅ garante que a tabela exista (se por algum motivo migrations não criaram)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  const email = "admin@campodogado.local";
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);

  if (exists) {
    console.log("✔ Seed: admin já existe");
    return;
  }

  const hash = bcrypt.hashSync("admin123", 10);

  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run("Administrador", email, hash, "ADMIN");

  console.log("✔ Seed: admin criado (admin@campodogado.local / admin123)");
}

module.exports = { seedAdminIfMissing };
