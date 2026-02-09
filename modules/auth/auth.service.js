const db = require("../../database/db");

exports.getUserByEmail = (email) => {
  return db
    .prepare(
      `
    SELECT id, name, email, role, password_hash
    FROM users
    WHERE lower(email) = lower(?)
    LIMIT 1
  `
    )
    .get(email);
};
