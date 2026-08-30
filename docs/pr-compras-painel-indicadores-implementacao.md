# PR — Implementação real dos indicadores inferiores do Painel de Compras

## Problema observado

A PR anterior #236 foi criada com a especificação, mas a implementação visual não foi realizada. A tela de Compras continua exibindo os quatro blocos inferiores praticamente inalterados:

- SOLICITAÇÕES POR STATUS: apenas lista textual de quantidades;
- CUSTOS DO PERÍODO: apenas uma frase com o total;
- OS VINCULADAS ÀS COMPRAS: apenas a quantidade de solicitações;
- RECEBIMENTOS PREVISTOS: apenas texto informativo.

Esta PR deve corrigir isso de forma efetiva no código do sistema.

## Regra principal

NÃO entregar somente documentação, CSS isolado ou uma PR de planejamento.

É obrigatório localizar a tela real exibida pelo ambiente atual e alterar o backend + EJS/CSS/JS necessários para que a mudança seja visível no Painel de Compras.

Antes de alterar qualquer arquivo, analisar a implementação real e reutilizar as estruturas existentes.

## Objetivo

Transformar a área inferior do Painel de Compras em um painel gerencial funcional e visualmente moderno, mantendo a parte superior existente.

Layout esperado:

Linha 1:
- Solicitações por Status
- Custos do Período

Linha 2:
- OS Vinculadas às Compras
- Recebimentos Previstos

## Solicitações por Status

Substituir a lista textual por gráfico real, preferencialmente barras horizontais em SVG/HTML/CSS.

Exibir quantidade, percentual e valor financeiro quando houver base confiável. Usar somente os status existentes. Quando possível, o clique deve reaproveitar os filtros existentes.

## Custos do Período

O período selecionado no topo deve controlar este card.

Exibir claramente:
- custo comprometido;
- custo recebido;
- custo pendente;
- total do período.

Adicionar gráfico financeiro real, preferencialmente por solicitação ou por semana/dia quando os dados permitirem.

Nunca inventar valores.

## Custo por Solicitação

Criar tabela/lista resumida com solicitação, título, OS, equipamento, fornecedor, valor total, valor recebido, valor pendente, percentual recebido e status. Usar barra de progresso e rota existente para `Abrir`.

## OS Vinculadas às Compras

Substituir o texto atual por tabela/card operacional real com solicitação, OS, equipamento, valor, progresso de recebimento e status. Usar a relação real existente, especialmente `solicitacoes.os_id` quando aplicável.

## Recebimentos Previstos

Substituir o texto atual por fila operacional usando `previsao_entrega` ou campo equivalente real. Exibir solicitação, fornecedor, data, valor, status e situação temporal: AGENDADO, HOJE, ATRASADO ou RECEBIDO.

## Dados financeiros

Antes de calcular custo recebido, verificar `solicitacoes.valor_total`, itens, cotações, recebimentos, `estoque_movimentos.valor_unitario` e quantidades. Se não houver preço unitário confiável, não apresentar estimativa como valor real. Se for indispensável persistir preço por item, criar migration incremental e não destrutiva.

## Filtros

Os filtros superiores continuam sendo a fonte única. Período, busca, setor, prioridade e responsável devem atualizar os indicadores inferiores quando aplicável.

## Back-end

Centralizar a lógica no service/controller existente. Criar funções reutilizáveis para resumo por status, resumo financeiro, custos por solicitação, OS vinculadas e recebimentos previstos. Não colocar SQL complexo no EJS e evitar consultas em loop.

## Front-end

Manter identidade visual atual. Os quatro blocos devem ter cabeçalho, indicadores, gráficos reais, barras de progresso, tabelas compactas, estados vazios e ações. Desktop em duas colunas, mobile em uma.

## Testes

Executar `npm test` e testes específicos. Validar período, status, custo total, custo recebido quando suportado, custo pendente, recebimento parcial/total, OS vinculada/não vinculada, previsão futura/hoje/atrasada e ausência de dados. Fazer validação manual da tela real.

## Critério visual obrigatório

Ao concluir, a página NÃO pode continuar apresentando apenas listas/frases nos quatro blocos. Os quatro componentes precisam apresentar visualmente os dados solicitados.

## Não fazer

Não reescrever o módulo inteiro, não remover tabela ou filtros, não inventar dados, não criar telas/rotas duplicadas, não alterar permissões e não quebrar Solicitação → Compras → Recebimento → Almoxarifado → Estoque.

## Entrega

Implementar código real nesta branch, executar testes e informar arquivos modificados, consultas, migrations e validações. Esta PR não deve ser encerrada como concluída se apenas a documentação tiver sido alterada.
