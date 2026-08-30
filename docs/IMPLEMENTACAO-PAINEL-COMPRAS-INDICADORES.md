# Tarefa Codex — Implementação real dos indicadores inferiores do Painel de Compras

A tela atual continua sem a melhoria visual solicitada. NÃO entregar somente documentação.

## Objetivo
Alterar efetivamente o Painel de Compras atual para transformar os quatro blocos inferiores em componentes gerenciais reais:

1. SOLICITAÇÕES POR STATUS: gráfico responsivo real, com quantidade e percentual, usando somente status existentes.
2. CUSTOS DO PERÍODO: comprometido, recebido, pendente e total, usando exatamente o período dos filtros superiores, com gráfico financeiro real.
3. OS VINCULADAS ÀS COMPRAS: tabela/card real com solicitação, OS, equipamento, valor, progresso e status, usando relacionamento existente.
4. RECEBIMENTOS PREVISTOS: fila real com solicitação, fornecedor, previsão, valor, status e AGENDADO/HOJE/ATRASADO/RECEBIDO.

## Obrigatório antes de editar
Localizar no código real a rota, controller, service e EJS que renderizam a tela mostrada. Não assumir nomes. Não criar tela paralela. Verificar a implementação atual e reutilizar arquitetura, filtros, status, RBAC e rotas existentes.

## Financeiro
Não inventar números. Verificar valor da solicitação, itens, cotações, recebimentos e `estoque_movimentos.valor_unitario`. Calcular recebido somente quando houver base confiável. Migration somente se indispensável, incremental e não destrutiva.

## UI
Manter padrão visual atual. Desktop em duas colunas, mobile em uma. Os quatro blocos devem deixar de ser apenas textos/frases e passar a apresentar gráficos, indicadores, tabelas, progresso e ações reais.

## Arquitetura
Lógica no service/controller. SQL complexo não deve ficar no EJS. Evitar consultas em loop. Reaproveitar funções existentes.

## Testes
Executar `npm test`, testes específicos e smoke test. Validar período, status, custos, recebimento parcial/total, OS vinculada/não vinculada, previsão futura/hoje/atrasada e ausência de dados.

## Critério de aceite
A implementação só será aceita quando a tela real de Compras apresentar visualmente a nova versão dos quatro blocos. Se a tela continuar igual à imagem atual, considerar a tarefa NÃO CONCLUÍDA.
