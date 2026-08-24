PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS preventiva_responsaveis_padrao (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mecanico_1_colaborador_id INTEGER NOT NULL,
  mecanico_2_colaborador_id INTEGER NOT NULL,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (mecanico_1_colaborador_id) REFERENCES colaboradores(id),
  FOREIGN KEY (mecanico_2_colaborador_id) REFERENCES colaboradores(id),
  FOREIGN KEY (updated_by) REFERENCES users(id),
  CHECK (mecanico_1_colaborador_id <> mecanico_2_colaborador_id)
);

-- Garante que qualquer OS preventiva criada por rotina semanal, controller ou job
-- já nasça com a dupla configurada em "Eleger Mecânico".
DROP TRIGGER IF EXISTS trg_os_preventiva_responsaveis_padrao;
CREATE TRIGGER trg_os_preventiva_responsaveis_padrao
AFTER INSERT ON os
WHEN UPPER(COALESCE(NEW.tipo, '')) = 'PREVENTIVA'
 AND UPPER(COALESCE(NEW.status, '')) IN ('ABERTA','AGUARDANDO_EQUIPE','PENDENTE','PROGRAMADA','AGENDADA')
 AND EXISTS (SELECT 1 FROM preventiva_responsaveis_padrao WHERE id = 1)
BEGIN
  UPDATE os
  SET executor_colaborador_id = (
        SELECT mecanico_1_colaborador_id
        FROM preventiva_responsaveis_padrao
        WHERE id = 1
      ),
      auxiliar_colaborador_id = (
        SELECT mecanico_2_colaborador_id
        FROM preventiva_responsaveis_padrao
        WHERE id = 1
      ),
      mecanico_user_id = (
        SELECT c.user_id
        FROM colaboradores c
        JOIN preventiva_responsaveis_padrao p ON p.mecanico_1_colaborador_id = c.id
        WHERE p.id = 1
      ),
      auxiliar_user_id = (
        SELECT c.user_id
        FROM colaboradores c
        JOIN preventiva_responsaveis_padrao p ON p.mecanico_2_colaborador_id = c.id
        WHERE p.id = 1
      ),
      alocacao_modo = 'AUTO',
      alocado_em = datetime('now','localtime')
  WHERE id = NEW.id;
END;
