PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS motores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT,                         -- patrimonio/codigo interno
  descricao TEXT NOT NULL,
  potencia_cv REAL,
  rpm INTEGER,
  origem_unidade TEXT NOT NULL DEFAULT 'RECICLAGEM',  -- RECICLAGEM|FRIGORIFICO
  local_instalacao TEXT,
  status TEXT NOT NULL DEFAULT 'EM_USO',              -- EM_USO|ENVIADO_REBOB|RETORNOU|RESERVA
  empresa_rebob TEXT,
  motorista_saida TEXT,
  data_saida TEXT,
  motorista_retorno TEXT,
  data_retorno TEXT,
  observacao TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_motores_codigo ON motores(codigo);
CREATE INDEX IF NOT EXISTS idx_motores_status ON motores(status);
CREATE INDEX IF NOT EXISTS idx_motores_origem ON motores(origem_unidade);
CREATE INDEX IF NOT EXISTS idx_motores_potencia ON motores(potencia_cv);
CREATE INDEX IF NOT EXISTS idx_motores_created ON motores(created_at);

-- histórico simples (eventos)
CREATE TABLE IF NOT EXISTS motores_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  motor_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,                     -- CADASTRO|ENVIAR|RETORNO|OBS
  payload TEXT,                           -- json string (texto)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(motor_id) REFERENCES motores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_motores_eventos_motor ON motores_eventos(motor_id);
CREATE INDEX IF NOT EXISTS idx_motores_eventos_created ON motores_eventos(created_at);
