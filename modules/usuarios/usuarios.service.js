// modules/usuarios/usuarios.service.js
const bcrypt = require("bcryptjs");
const db = require("../../database/db");

function list({ q = "", role = "" } = {}) {
  const where = [];
  const params = {};

  if (q) {
    where.push("(u.name LIKE @q OR u.email LIKE @q)");
    params.q = `%${q}%`;
  }
  if (role) {
    where.push("u.role = @role");
    params.role = role;
  }

  const sql = `
    SELECT u.id, u.name, u.email, u.role, u.created_at
    FROM users u
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY u.id DESC
  `;

  return db.prepare(sql).all(params);
}

function getById(id) {
  return db
    .prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?")
    .get(id);
}

function getByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function create({ name, email, role, password }) {
  const exists = getByEmail(email);
  if (exists) throw new Error("Já existe usuário com esse e-mail.");

  const password_hash = bcrypt.hashSync(password, 10);

  const created_at = new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(name, email, password_hash, role, created_at);

  return info.lastInsertRowid;
}

function update(id, { name, email, role }) {
  const current = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!current) throw new Error("Usuário não encontrado.");

  const other = db.prepare("SELECT id FROM users WHERE email = ? AND id <> ?").get(email, id);
  if (other) throw new Error("Este e-mail já está sendo usado por outro usuário.");

  db.prepare("UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?").run(
    name,
    email,
    role,
    id
  );
}

function resetPassword(id, password) {
  const current = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!current) throw new Error("Usuário não encontrado.");

  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(password_hash, id);
}

module.exports = { list, getById, create, update, resetPassword };
