-- 062_expand_roles_users.sql
PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- 1) renomeia tabela atual (se existir)
ALTER TABLE users RENAME TO users_old;

-- 2) recria com CHECK de roles ampliado (tudo em MAIÚSCULO)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,

  -- ✅ ROLES ampliados
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

-- 3) copia dados (normaliza role para MAIÚSCULO)
INSERT INTO users (id, name, email, password_hash, role, created_at)
SELECT
  id,
  name,
  email,
  password_hash,
  UPPER(role),
  created_at
FROM users_old;

-- 4) garante autoincrement continuar depois do maior id existente
DELETE FROM sqlite_sequence WHERE name='users';
INSERT INTO sqlite_sequence(name, seq)
SELECT 'users', COALESCE(MAX(id),0) FROM users;

-- 5) remove tabela antiga
DROP TABLE users_old;

COMMIT;

PRAGMA foreign_keys = ON;
