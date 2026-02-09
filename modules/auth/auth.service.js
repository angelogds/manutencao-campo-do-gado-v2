const bcrypt = require("bcryptjs");
const db = require("../../database/db");

function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email?.toLowerCase());
}

function verifyPassword(password, password_hash) {
  if (!password || !password_hash) return false;
  return bcrypt.compareSync(password, password_hash);
}

module.exports = { findUserByEmail, verifyPassword };
