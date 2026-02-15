PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS estoque_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'DIVERSOS',
  unidade TEXT NOT NULL DEFAULT 'UN',
  estoque_min REAL NOT NULL DEFAULT 0,
  custo_unit REAL NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_estoque_itens_codigo ON estoque_itens(codigo);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_nome ON estoque_itens(nome);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_categoria ON estoque_itens(categoria);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_ativo ON estoque_itens(ativo);

CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,                 -- ENTRADA | SAIDA | AJUSTE
  quantidade REAL NOT NULL,           -- ENTRADA/SAIDA = delta | AJUSTE = saldo_final
  custo_unit REAL,                    -- opcional
  origem TEXT NOT NULL DEFAULT 'AJUSTE', -- COMPRA|RETIRADA|AJUSTE|INVENTARIO
  referencia_id INTEGER,
  observacao TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(item_id) REFERENCES estoque_itens(id)
);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_item ON estoque_movimentos(item_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_tipo ON estoque_movimentos(tipo);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_created ON estoque_movimentos(created_at);
