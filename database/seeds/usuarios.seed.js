const bcrypt = require('bcryptjs');
const db = require('../db');

const password = bcrypt.hashSync('admin123', 10);

db.prepare(`
  INSERT OR IGNORE INTO users (name, email, password_hash, role, created_at)
  VALUES (?, ?, ?, ?, ?)
`).run(
  'Administrador',
  'admin@campodogado.local',
  password,
  'ADMIN',
  new Date().toISOString()
);

console.log('✔ Usuário ADMIN criado');
