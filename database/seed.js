const bcrypt = require("bcryptjs");
const db = require("./db");

function ensureAdmin() {
  const row = db.prepare("SELECT id FROM users WHERE email=? LIMIT 1").get("admin@campodogado.local");
  if (row) {
    console.log("✔ Seed: admin já existe");
    return;
  }

  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, 'ADMIN', datetime('now','-3 hours'))
  `).run("Administrador", "admin@campodogado.local", hash);

  console.log("✔ Seed: admin criado (admin@campodogado.local / admin123)");
}

module.exports = { ensureAdmin };
