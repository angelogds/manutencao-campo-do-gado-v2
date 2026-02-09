const bcrypt = require("bcryptjs");
const db = require("../../database/db");

exports.listUsers = () => {
  return db.prepare(`
    SELECT id, name, email, role, created_at
    FROM users
    ORDER BY id DESC
  `).all();
};

exports.getUserById = (id) => {
  return db.prepare(`
    SELECT id, name, email, role, created_at
    FROM users
    WHERE id = ?
  `).get(id);
};

exports.createUser = ({ name, email, role, password }) => {
  const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (exists) throw new Error("Já existe usuário com esse e-mail.");

  const password_hash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(name, email, password_hash, role);
};

exports.updateUser = ({ id, name, email, role }) => {
  const exists = db.prepare(`SELECT id FROM users WHERE email = ? AND id != ?`).get(email, id);
  if (exists) throw new Error("Outro usuário já usa esse e-mail.");

  const res = db.prepare(`
    UPDATE users
    SET name = ?, email = ?, role = ?
    WHERE id = ?
  `).run(name, email, role, id);

  if (res.changes === 0) throw new Error("Usuário não encontrado para atualizar.");
};

exports.resetPassword = ({ id, newPassword }) => {
  const password_hash = bcrypt.hashSync(newPassword, 10);

  const res = db.prepare(`
    UPDATE users
    SET password_hash = ?
    WHERE id = ?
  `).run(password_hash, id);

  if (res.changes === 0) throw new Error("Usuário não encontrado para resetar senha.");
};
