PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS motores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT,
  descricao TEXT NOT NULL,
  potencia_cv REAL,
  rpm INTEGER,
  origem_unidade TEXT NOT NULL DEFAULT 'RECICLAGEM', -- RECICLAGEM|FRIGORIFICO
  local_instalacao TEXT,
  status TEXT NOT NULL DEFAULT 'EM_USO', -- EM_USO|ENVIADO_REBOB|RETORNOU|RESERVA
  empresa_rebob TEXT,
  motorista_saida TEXT,
  data_saida TEXT,
  motorista_retorno TEXT,
  data_retorno TEXT,
  observacao TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_motores_status ON motores(status);

CREATE TABLE IF NOT EXISTS motores_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motor_id INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- ENVIAR|RETORNO|OBS
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(motor_id) REFERENCES motores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_motores_eventos_motor ON motores_eventos(motor_id);
