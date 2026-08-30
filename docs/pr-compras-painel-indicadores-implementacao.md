# PR — Implementação real dos indicadores inferiores do Painel de Compras

A PR anterior documentou a melhoria, mas a tela continuou sem mudança visual. Esta tarefa exige implementação real no código.

## Obrigatório

Antes de alterar, analisar o repositório real e localizar a rota/controller/service/view que efetivamente renderiza o Painel de Compras mostrado no ambiente atual. Não assumir nomes de arquivos.

Localizar os quatro blocos:
- SOLICITAÇÕES POR STATUS
- CUSTOS DO PERÍODO
- OS VINCULADAS ÀS COMPRAS
- RECEBIMENTOS PREVISTOS

Alterar backend + EJS/CSS/JS necessários para que a mudança seja visível.

## Resultado esperado

1. Solicitações por Status: gráfico real (preferencialmente barras SVG/HTML/CSS), com quantidade e percentual; valor financeiro quando houver base confiável.
2. Custos do Período: custo comprometido, custo recebido, custo pendente e total, usando exatamente o período selecionado no topo, com gráfico financeiro real.
3. Custo por solicitação: solicitação, título, OS, equipamento, fornecedor, valor total, recebido, pendente, percentual e status, com barra de progresso.
4. OS vinculadas: tabela/card real usando o relacionamento existente, especialmente `solicitacoes.os_id` quando aplicável.
5. Recebimentos previstos: solicitação, fornecedor, previsão, valor, status e classificação AGENDADO/HOJE/ATRASADO/RECEBIDO.
6. Filtros superiores devem continuar sendo a fonte única dos indicadores.
7. Responsividade: duas colunas em desktop e uma em mobile.
8. Preservar RBAC e o fluxo Solicitação → Compras → Recebimento → Almoxarifado → Estoque.

## Financeiro

Não inventar valores. Verificar `solicitacoes.valor_total`, itens, cotações, recebimentos e `estoque_movimentos.valor_unitario`. Só calcular custo recebido quando houver base confiável. Se for necessária persistência de preço por item, criar migration incremental e não destrutiva.

## Arquitetura

Centralizar consultas no service/controller existente. Não colocar SQL complexo no EJS. Evitar consultas em loop. Reutilizar filtros, status, rotas e funções existentes.

## Testes

Executar `npm test` e testes específicos para período, status, custos, recebimento parcial/total, OS vinculada/não vinculada, previsão e ausência de dados. Fazer smoke test e validação manual da tela real.

## Critério de aceite

Não considerar concluído se os quatro blocos inferiores continuarem sendo apenas textos/frases. A PR deve conter alterações reais de backend e frontend que apareçam na tela de Compras.

Não reescrever o módulo inteiro, não remover funcionalidades, não apagar dados e não criar telas paralelas.
