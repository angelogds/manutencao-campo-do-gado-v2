const db = require("../../database/db");
const bcrypt = require("bcryptjs");

function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ? LIMIT 1").get(email);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  findUserByEmail,
  verifyPassword,
};
