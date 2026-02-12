// database/seed.js
const bcrypt = require("bcryptjs");
const db = require("./db");

function ensureAdmin() {
  const row = db
    .prepare("SELECT id FROM users WHERE lower(email)=lower(?) LIMIT 1")
    .get("admin@campodogado.local");

  if (row) {
    console.log("✔ Seed: admin já existe");
    return;
  }

  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash = bcrypt.hashSync(password, 10);

  db.prepare(
    `
    INSERT INTO users (name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, 'ADMIN', datetime('now','-3 hours'))
  `
  ).run("Administrador", "admin@campodogado.local", hash);

  console.log("✔ Seed: admin criado (admin@campodogado.local / admin123)");
}

/**
 * ✅ Publica a escala 2026 (PDF) para aparecer no módulo Escala
 * Caminho do PDF:
 *   public/docs/ESCALA_SEMANAL_COMPLETA_NOITE_DIA_2026.pdf
 */
function ensureEscalaPublica2026() {
  const slug = "escala-2026-noite-dia";
  const titulo = "Escala Semanal Completa • Noite/Dia • 2026";
  const arquivo_url = "/docs/ESCALA_SEMANAL_COMPLETA_NOITE_DIA_2026.pdf";

  // 1) tenta verificar se existe tabela
  const hasTable = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='escala_publicacoes'`
    )
    .get();

  if (!hasTable) {
    console.warn(
      "⚠️ Seed escala: tabela escala_publicacoes NÃO existe. (Sem problema) " +
        "Se quiser a publicação aparecer automaticamente, crie a migration dessa tabela."
    );
    return;
  }

  const exists = db
    .prepare(`SELECT id FROM escala_publicacoes WHERE slug=? LIMIT 1`)
    .get(slug);

  if (exists) {
    console.log("✔ Seed: escala 2026 já publicada");
    return;
  }

  db.prepare(
    `
    INSERT INTO escala_publicacoes
      (slug, titulo, arquivo_url, ativo, created_at)
    VALUES
      (?, ?, ?, 1, datetime('now','-3 hours'))
  `
  ).run(slug, titulo, arquivo_url);

  console.log("✔ Seed: escala 2026 publicada (PDF)");
}

function runSeeds() {
  try {
    ensureAdmin();
  } catch (e) {
    console.warn("⚠️ Seed admin falhou:", e.message);
  }

  try {
    ensureEscalaPublica2026();
  } catch (e) {
    console.warn("⚠️ Seed escala falhou:", e.message);
  }
}

module.exports = { ensureAdmin, ensureEscalaPublica2026, runSeeds };
