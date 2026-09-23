CREATE TABLE IF NOT EXISTS compras_solicitacao_visualizacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  visualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (solicitacao_id, user_id),
  FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_compras_visualizacoes_user
  ON compras_solicitacao_visualizacoes(user_id, solicitacao_id);

CREATE TABLE IF NOT EXISTS compras_sinalizacao_meta (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

INSERT OR IGNORE INTO compras_sinalizacao_meta (chave, valor)
VALUES ('ativado_em', datetime('now'));
