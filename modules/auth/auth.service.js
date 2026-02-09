const db = require('../../database/db');
const bcrypt = require('bcryptjs');

function authenticate(email, password) {
  const user = db.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).get(email);

  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;

  return user;
}

module.exports = { authenticate };
