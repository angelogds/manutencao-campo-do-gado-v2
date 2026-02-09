// database/seed.js
const bcrypt = require("bcryptjs");
const db = require("./db");

function ensureAdmin() {
  try {
    // verifica se já existe algum ADMIN
    const admin = db
      .prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1")
      .get();

    if (admin) {
      console.log("✔ Seed: admin já existe");
      return;
    }

    const password = process.env.ADMIN_PASSWORD || "admin123";
    const hash = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, 'ADMIN', datetime('now','-3 hours'))
    `).run(
      "Administrador",
      "admin@campodogado.local",
      hash
    );

    console.log("✔ Seed: admin criado (admin@campodogado.local / admin123)");
  } catch (err) {
    console.error("❌ Erro ao executar seed do admin:", err.message);
  }
}

module.exports = { ensureAdmin };
