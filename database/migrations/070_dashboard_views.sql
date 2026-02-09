PRAGMA foreign_keys = ON;

-- OS abertas (status maiúsculo do seu 030_os.sql)
CREATE VIEW IF NOT EXISTS vw_dashboard_os_abertas AS
SELECT COUNT(*) AS total
FROM os
WHERE status IN ('ABERTA','ANDAMENTO','PAUSADA');

-- Compras abertas (tabelas 050 usam status em minúsculo)
CREATE VIEW IF NOT EXISTS vw_dashboard_compras_abertas AS
SELECT COUNT(*) AS total
FROM solicitacoes_compra
WHERE status IN ('aberta','cotacao','aprovada');

-- Itens abaixo do mínimo
CREATE VIEW IF NOT EXISTS vw_dashboard_itens_abaixo_minimo AS
SELECT COUNT(*) AS total
FROM vw_estoque_saldo s
JOIN estoque_itens i ON i.id = s.item_id
WHERE s.saldo < COALESCE(i.estoque_min,0);
