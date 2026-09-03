# PR — Integração real entre Compras, Almoxarifado e Estoque

## Objetivo

Tornar os módulos Almoxarifado e Estoque realmente funcionais dentro do fluxo operacional já existente:

**Solicitação → Cotação → Compra → Recebimento parcial/total → Estoque**

A ideia é que o Almoxarifado acompanhe a mesma solicitação criada na origem e veja, em uma única tela, o que foi solicitado, o que já está em cotação, o que já foi comprado, o que já chegou e o que ainda está pendente.

## Diagnóstico da implementação atual

O repositório já possui a estrutura `solicitacoes` + `solicitacao_itens`, incluindo `status`, `fornecedor`, `previsao_entrega`, `valor_total`, `qtd_solicitada`, `qtd_recebida_total`, `status_item` e `estoque_item_id`.

O Almoxarifado já lista solicitações COMPRADA, EM_RECEBIMENTO, RECEBIDA_PARCIAL e FECHADA e possui uma tela separada de conferência. Porém, a listagem atual mostra basicamente número, solicitante, status e ações; a conferência mostra quantidades, mas não apresenta claramente o ciclo de cotação/compra/recebimento por item.

Também foram identificadas inconsistências que devem ser corrigidas sem regressão:

1. `iniciarRecebimento()` aceita somente `COMPRADA`, enquanto a view permite iniciar também `REABERTA`.
2. `listRecebimentos()` não inclui `REABERTA`, portanto uma solicitação reaberta pode desaparecer da fila.
3. `receberItem()` atualmente permite que a quantidade recebida ultrapasse a quantidade solicitada. Isso deve ser bloqueado ou exigir regra explícita de excesso; não aceitar recebimento silencioso acima do saldo pendente.
4. `fechar()` atualmente permite fechar `RECEBIDA_PARCIAL`. Para o fluxo proposto, a solicitação só deve ser encerrada definitivamente quando todos os itens estiverem completos, salvo uma ação administrativa explícita e auditável para exceção.
5. A entrada em estoque já é criada como `ENTRADA_COMPRA`, mas o vínculo precisa permanecer rastreável à solicitação/item.

## Regra operacional desejada

Assim que Compras iniciar uma cotação, a solicitação continua sendo a mesma entidade e passa a ser visível no Almoxarifado para acompanhamento.

O Almoxarifado não deve criar uma nova solicitação.

Ao abrir uma solicitação, mostrar uma linha do tempo/status:

**ABERTA → EM COTAÇÃO → COMPRADA → EM RECEBIMENTO → RECEBIDA PARCIAL → RECEBIDA TOTAL → FECHADA**

E, por item:

- Solicitado
- Em cotação
- Comprado
- Recebido
- Pendente
- Status do item
- Fornecedor, quando disponível
- Previsão de entrega, quando disponível

Itens podem ter fornecedores/prazos diferentes. Portanto, a solicitação não deve depender de uma única data ou de um único recebimento para acompanhar cada item.

## Tela principal do Almoxarifado

Modernizar `Recebimentos de Compras` mantendo a arquitetura atual.

Exibir cards/KPIs:

- Para receber
- Em recebimento
- Recebimento parcial
- Recebidos totalmente
- Atrasados

Criar tabela no mesmo padrão visual das telas de Solicitações e Compras.

Colunas sugeridas:

- Solicitação
- Título
- Setor
- OS/Equipamento
- Itens
- Comprados
- Recebidos
- Pendentes
- Progresso
- Previsão
- Status
- Ações

Permitir busca/filtro por número, título, setor, status, fornecedor, OS/equipamento e situação de recebimento, reutilizando padrões existentes.

## Detalhe da solicitação no Almoxarifado

Ao clicar em uma solicitação, abrir uma visão completa.

Cabeçalho:

- Número
- Título
- Setor solicitante
- OS/equipamento
- Prioridade
- Responsável de Compras
- Responsável do Almoxarifado
- Status geral
- Fornecedor(es)
- Previsão(ões)

Resumo:

- Total de itens
- Itens cotados
- Itens comprados
- Itens recebidos
- Itens pendentes
- Percentual recebido

Tabela de itens:

| Item | Solicitado | Cotado | Comprado | Recebido | Pendente | Fornecedor | Previsão | Status | Ação |

Não inventar dados de cotação/compra quando o banco não tiver informação por item. Mostrar `Não informado` quando necessário.

## Conferência de recebimento

Manter o recebimento incremental.

Exemplo:

Solicitado: 20 UN

Primeira entrega: 8 UN

Segunda entrega: 7 UN

Terceira entrega: 5 UN

Resultado final: 20/20 — RECEBIDO TOTAL.

A cada recebimento:

1. validar item;
2. validar quantidade positiva;
3. calcular pendente atual;
4. impedir recebimento acima do saldo pendente, salvo regra administrativa explicitamente implementada;
5. atualizar `qtd_recebida_total`;
6. atualizar `status_item`;
7. registrar movimento `ENTRADA_COMPRA` no estoque;
8. manter `referencia_tipo='SOLICITACAO'` e `referencia_id`;
9. atualizar status geral da solicitação;
10. manter histórico suficiente para auditoria.

## Estoque

O recebimento confirmado no Almoxarifado deve alimentar o saldo do Estoque automaticamente, sem lançamento manual duplicado.

O movimento deve permanecer rastreável à solicitação.

Ao consultar o item no Estoque, permitir identificar:

- origem da entrada;
- solicitação;
- data/hora;
- quantidade;
- usuário responsável;
- observação;
- valor unitário quando existir dado confiável.

Não criar uma segunda movimentação para o mesmo recebimento.

## Status geral

A lógica deve ser determinística:

- nenhum item recebido → COMPRADA/EM_RECEBIMENTO conforme fluxo;
- algum item recebido e algum pendente → RECEBIDA_PARCIAL;
- todos os itens completos → RECEBIDA_TOTAL;
- somente RECEBIDA_TOTAL pode ser FECHADA automaticamente pelo fluxo normal;
- REABERTA deve voltar para uma fila operacional coerente e permitir continuidade do recebimento.

Preservar os status existentes; não criar nomenclaturas paralelas.

## Compras → Almoxarifado

Não duplicar dados entre módulos.

Compras continua responsável por:

- cotação;
- seleção de fornecedor;
- preço;
- compra;
- previsão de entrega.

Almoxarifado continua responsável por:

- conferência física;
- quantidade recebida;
- recebimento parcial;
- recebimento total;
- observação da conferência;
- entrada no estoque.

Estoque continua responsável por:

- saldo;
- movimentações;
- entradas;
- saídas;
- histórico do item.

## Banco de dados

Antes de alterar o banco, analisar todas as migrations já aplicadas.

Usar as estruturas existentes, especialmente:

- `solicitacoes`
- `solicitacao_itens`
- `compras_cotacoes`
- `estoque_itens`
- `estoque_movimentos`

Somente criar migration nova se for indispensável para armazenar uma informação que realmente não exista.

Nunca alterar migration histórica de produção.

Nunca apagar dados.

Se for necessário registrar cotação/compra por item para atender a visão detalhada, criar estrutura incremental e preservar registros existentes.

## Permissões

Respeitar `config/rbac.js`.

Almoxarifado deve ter acesso operacional de recebimento.

Estoque deve manter as permissões existentes.

Compras não deve receber automaticamente permissão de alterar recebimento físico apenas por visualizar o fluxo.

Não ampliar RBAC sem necessidade.

## Responsividade

Desktop: tabela completa e indicadores.

Tablet: tabela adaptada.

Celular: transformar linhas em cards/resumo quando necessário, com ações grandes e fáceis de tocar.

A conferência deve ser especialmente eficiente no celular, pois o usuário pode estar recebendo material diretamente no almoxarifado.

## UX

Priorizar leitura rápida:

- progresso visual;
- status por item;
- pendências destacadas;
- botão `Conferir recebimento`;
- botão `Ver solicitação`;
- previsão de entrega;
- fornecedor;
- quantidade pendente.

Evitar excesso de modais. Usar a página de detalhe quando houver muitos dados.

## Testes obrigatórios

Testar:

1. solicitação em cotação aparecendo no Almoxarifado;
2. solicitação comprada aparecendo para receber;
3. abertura do detalhe mostrando cotação/compra quando houver dados;
4. itens com prazos diferentes;
5. recebimento parcial;
6. segundo recebimento da mesma solicitação;
7. recebimento total;
8. tentativa de receber acima do pendente;
9. entrada automática no estoque;
10. ausência de `estoque_item_id`;
11. solicitação reaberta;
12. fechamento somente quando aplicável;
13. rastreabilidade do movimento de estoque;
14. permissões de ALMOXARIFADO, COMPRAS e ADMIN;
15. mobile;
16. ausência de itens;
17. ausência de cotação;
18. ausência de fornecedor/previsão.

Executar `npm test` e os testes específicos existentes.

## Critério de aceite

A tarefa só estará concluída quando:

- o Almoxarifado enxergar a mesma solicitação que Compras está tratando;
- ao abrir a solicitação for possível entender o que está cotado, comprado, recebido e pendente;
- itens puderem ser recebidos em entregas diferentes;
- cada recebimento atualizar o item e o estoque;
- o saldo do estoque refletir o recebimento real;
- a solicitação permanecer aberta enquanto houver pendência;
- a solicitação fechar somente quando estiver integralmente recebida no fluxo normal;
- o histórico permanecer rastreável;
- as telas seguirem o padrão visual do restante do sistema;
- funcionar bem em computador e celular;
- não houver regressão nas rotas existentes.

## Regra final para o Codex

ANALISAR O CÓDIGO REAL → MAPEAR O FLUXO ATUAL → IDENTIFICAR DEPENDÊNCIAS → IMPLEMENTAR LOCALMENTE → TESTAR → VALIDAR INTEGRAÇÃO.

Não reescrever os módulos inteiros.

Não criar telas paralelas.

Não duplicar solicitações.

Não inventar cotação, compra, preço ou recebimento.

Preservar dados existentes e o fluxo:

**SOLICITAÇÃO → COMPRAS → RECEBIMENTO/ALMOXARIFADO → ESTOQUE**.
