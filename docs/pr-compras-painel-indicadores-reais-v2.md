# IMPLEMENTAÇÃO OBRIGATÓRIA — Painel de Compras

A tela mostrada pelo usuário continua praticamente igual após a PR anterior. Esta tarefa deve produzir mudança REAL no código e na interface.

## Antes de editar

Analisar a main atual, localizar a rota/controller/service/view reais do Painel de Compras e localizar os quatro blocos pelos textos `SOLICITAÇÕES POR STATUS`, `CUSTOS DO PERÍODO`, `OS VINCULADAS ÀS COMPRAS` e `RECEBIMENTOS PREVISTOS`. Não criar tela paralela.

## Implementar

1. Solicitações por Status: gráfico real responsivo, preferencialmente SVG/HTML/CSS, usando status existentes; quantidade e percentual; valor financeiro quando confiável.
2. Custos do Período: usar exatamente o período selecionado no topo; mostrar custo comprometido, recebido, pendente e total; adicionar gráfico financeiro real.
3. Custo por Solicitação: mostrar solicitação, título, OS, equipamento, fornecedor, valor total, recebido, pendente, percentual e status, com barra de progresso.
4. OS Vinculadas: tabela/card real usando o relacionamento existente (`os_id` quando aplicável), com valor, progresso e status.
5. Recebimentos Previstos: fila real usando `previsao_entrega` ou campo equivalente, com AGENDADO/HOJE/ATRASADO/RECEBIDO.

## Financeiro

Não inventar valores. Verificar `solicitacoes.valor_total`, itens, cotações, recebimentos e `estoque_movimentos.valor_unitario`. Só calcular custo recebido quando houver base confiável. Migration apenas se realmente necessária e sempre incremental/não destrutiva.

## Arquitetura e UI

Centralizar lógica no service/controller existente; SQL complexo não deve ficar no EJS; evitar consultas em loop. Manter identidade visual atual, duas colunas no desktop e uma no mobile. Os quatro blocos devem deixar de ser apenas frases/listas.

## Filtros e segurança

Os filtros superiores continuam sendo a fonte única. Preservar RBAC e o fluxo Solicitação → Compras → Recebimento → Almoxarifado → Estoque.

## Testes

Executar `npm test`, testes específicos e smoke test. Validar período, status, valores, recebimento parcial/total, OS vinculada/não vinculada, previsão futura/hoje/atrasada e ausência de dados.

## Critério de aceite

Não considerar concluído se a tela continuar visualmente igual à imagem fornecida. A PR precisa conter alterações reais no backend e frontend que apareçam no Painel de Compras.
