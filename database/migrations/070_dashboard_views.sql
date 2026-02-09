-- Views simples para cards do dashboard (quantidades)

CREATE VIEW IF NOT EXISTS vw_dashboard_os_abertas AS
SELECT COUNT(*) AS total
FROM os
WHERE COALESCE(status,'aberta') IN ('aberta','andamento');

CREATE VIEW IF NOT EXISTS vw_dashboard_compras_abertas AS
SELECT COUNT(*) AS total
FROM solicitacoes_compra
WHERE status IN ('aberta','cotacao','aprovada');

CREATE VIEW IF NOT EXISTS vw_dashboard_itens_abaixo_minimo AS
SELECT COUNT(*) AS total
FROM vw_estoque_saldo s
JOIN estoque_itens i ON i.id = s.item_id
WHERE s.saldo < COALESCE(i.estoque_min,0);
