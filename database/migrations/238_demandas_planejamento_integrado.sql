PRAGMA foreign_keys = ON;

-- Evolução não destrutiva do módulo de Demandas.
-- Mantém os registros existentes e acrescenta somente campos de planejamento.
ALTER TABLE demandas ADD COLUMN demanda_pai_id INTEGER REFERENCES demandas(id);
ALTER TABLE demandas ADD COLUMN equipamento_id INTEGER REFERENCES equipamentos(id);
ALTER TABLE demandas ADD COLUMN categoria TEXT NOT NULL DEFAULT 'MANUTENCAO';
ALTER TABLE demandas ADD COLUMN setor_origem TEXT;
ALTER TABLE demandas ADD COLUMN nr_referencia TEXT;
ALTER TABLE demandas ADD COLUMN prazo_previsto TEXT;
ALTER TABLE demandas ADD COLUMN custo_servicos_estimado REAL NOT NULL DEFAULT 0;
ALTER TABLE demandas ADD COLUMN aprovacao_status TEXT NOT NULL DEFAULT 'NAO_SUBMETIDA';

ALTER TABLE os ADD COLUMN demanda_id INTEGER REFERENCES demandas(id);

CREATE INDEX IF NOT EXISTS idx_demandas_pai ON demandas(demanda_pai_id);
CREATE INDEX IF NOT EXISTS idx_demandas_equipamento ON demandas(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_demandas_categoria ON demandas(categoria);
CREATE INDEX IF NOT EXISTS idx_demandas_aprovacao ON demandas(aprovacao_status);
CREATE INDEX IF NOT EXISTS idx_os_demanda ON os(demanda_id);
