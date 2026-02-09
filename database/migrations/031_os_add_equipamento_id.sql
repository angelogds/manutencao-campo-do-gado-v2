PRAGMA foreign_keys = ON;

-- Adiciona equipamento_id na OS se ainda não existir
ALTER TABLE os ADD COLUMN equipamento_id INTEGER;

-- Não dá para adicionar FK via ALTER TABLE no SQLite facilmente sem rebuild.
-- Então a gente garante índice, e validação fica no app por enquanto.
CREATE INDEX IF NOT EXISTS idx_os_equipamento_id ON os(equipamento_id);
