PRAGMA foreign_keys = ON;

-- OS
CREATE INDEX IF NOT EXISTS idx_os_status ON os(status);
CREATE INDEX IF NOT EXISTS idx_os_created_at ON os(created_at);

-- Compras
CREATE INDEX IF NOT EXISTS idx_compra_created_at ON compras(created_at);

-- Estoque
CREATE INDEX IF NOT EXISTS idx_estoque_saldo_item ON estoque_movimentos(item_id);
