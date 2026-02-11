-- 062_expand_roles_users.sql
PRAGMA foreign_keys = OFF;

ALTER TABLE users RENAME TO users_old;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN (
      'ADMIN',
      'DIRECAO',
      'RH',
      'COMPRAS',
      'MANUTENCAO',
      'PRODUCAO',
      'ALMOXARIFADO',
      'MECANICO'
    )
  ),
  created_at TEXT NOT NULL
);

INSERT INTO users (id, name, email, password_hash, role, created_at)
SELECT
  id,
  name,
  email,
  password_hash,
  UPPER(role),
  created_at
FROM users_old;

DELETE FROM sqlite_sequence WHERE name='users';
INSERT INTO sqlite_sequence(name, seq)
SELECT 'users', COALESCE(MAX(id),0) FROM users;

DROP TABLE users_old;

PRAGMA foreign_keys = ON;
