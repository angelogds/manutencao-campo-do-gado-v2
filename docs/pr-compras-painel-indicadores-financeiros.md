# PR / CODEX — Modernizar e tornar reais os indicadores inferiores do Painel de Compras

## CONTEXTO

Repositório real:

`angelogds/manutencao-campo-do-gado-v2`

Branch base:

`main`

Objetivo desta alteração:

Modernizar exclusivamente a área inferior do **Painel de Compras**, mantendo o layout superior já existente e preservando todas as funcionalidades atuais.

A área inferior atualmente apresenta blocos simples para:

- Solicitações por status
- Custos do período
- OS vinculadas às compras
- Recebimentos previstos

Precisamos transformar esses blocos em um **painel gerencial real de compras**, com dados financeiros, progresso de recebimento, integração com OS e previsões de entrega.

IMPORTANTE: antes de alterar qualquer arquivo, ANALISE O REPOSITÓRIO REAL E A IMPLEMENTAÇÃO ATUAL. Não assumir nomes de arquivos, rotas, tabelas ou funções sem verificar.

A `main` atual já possui a estrutura do módulo Compras, serviços, solicitações, cotações e recebimentos. Entre as estruturas encontradas estão:

- `modules/compras/compras.service.js`
- `modules/compras/compras.controller.js`
- `modules/compras/compras.routes.js`
- `views/compras/solicitacoes/index.ejs`
- `views/compras/solicitacoes/show.ejs`
- `database/migrations/108_solicitacoes_fluxo_compras_almox_estoque.sql`
- `database/migrations/112_compras_v3_fluxo.sql`
- `database/migrations/113_compras_alter_solicitacoes.js`
- `modules/almoxarifado/almoxarifado.service.js`
- `config/rbac.js`

A estrutura atual já possui `solicitacoes.valor_total`, `previsao_entrega`, `os_id`, `equipamento_id`, status do fluxo e itens da solicitação. O módulo também possui cotações e recebimentos.

## OBJETIVO FUNCIONAL

Transformar a parte inferior do Painel de Compras em uma área de análise operacional e financeira.

Manter o padrão visual já existente no painel.

Não reescrever o módulo Compras inteiro.

Não alterar a tabela principal de solicitações, exceto onde for estritamente necessário para disponibilizar os dados dos novos indicadores.

## 1. SOLICITAÇÕES POR STATUS

Substituir o bloco textual atual por um componente visual real.

Exibir os status existentes no fluxo de Compras:

- ABERTA
- EM_COTACAO
- COMPRADA
- EM_RECEBIMENTO
- RECEBIDA_PARCIAL
- RECEBIDA_TOTAL
- FECHADA
- REABERTA

Não inventar novos status.

Criar gráfico preferencialmente em barras horizontais ou donut/pizza. Priorizar gráfico de barras se isso melhorar leitura dos valores.

Cada status deve mostrar:

- quantidade
- percentual do total
- valor financeiro correspondente quando houver dado disponível

Permitir clique no status para aplicar o filtro correspondente na tabela principal, reutilizando as rotas/filtros existentes quando possível.

## 2. CUSTOS DO PERÍODO

O período selecionado no filtro superior deve controlar também os indicadores inferiores.

Criar card gerencial com:

- Custo comprometido
- Custo recebido
- Custo pendente
- Total das solicitações no período

Também exibir gráfico mostrando a evolução dos custos no período.

Preferencialmente custo por solicitação ou custo por dia/semana, caso haja dados confiáveis suficientes.

## 3. REGRA DE CONFIABILIDADE FINANCEIRA

NÃO INVENTAR VALOR.

NÃO considerar como custo recebido um valor que não esteja sustentado pelos dados do banco.

A estrutura atual possui `solicitacoes.valor_total`, mas o recebimento atual trabalha principalmente com quantidade recebida por item.

Antes de criar qualquer cálculo financeiro:

1. analisar as tabelas atuais;
2. verificar como `valor_total` é preenchido;
3. verificar como cotações são armazenadas;
4. verificar como o recebimento é gravado;
5. verificar `estoque_movimentos.valor_unitario`;
6. identificar se existe preço por item confiável;
7. só então definir o cálculo.

Caso o sistema não possua informação suficiente para determinar o custo recebido por item:

- não fabricar um número como se fosse real;
- utilizar somente métricas financeiramente sustentadas;
- deixar explícito no código quando determinado indicador não puder ser calculado com precisão;
- quando necessário, implementar estrutura mínima e compatível para armazenar o preço unitário real.

Se for necessária alteração de banco:

- criar migration nova;
- não modificar migration antiga já aplicada;
- preservar todos os dados;
- não apagar tabelas;
- não recriar tabelas de forma destrutiva;
- garantir compatibilidade com instalações existentes.

## 4. CUSTO POR SOLICITAÇÃO

Criar visualização com:

- número da solicitação
- título
- OS vinculada
- equipamento
- fornecedor
- valor total
- valor recebido
- valor pendente
- percentual recebido
- status

Exibir barra horizontal de progresso.

Ordenar preferencialmente por maior valor ou prioridade operacional.

Adicionar botão `Abrir` reutilizando a rota atual da solicitação.

## 5. OS VINCULADAS ÀS COMPRAS

Transformar o card atual de “OS vinculadas às compras” em tabela operacional.

Exibir:

- Solicitação
- OS
- Equipamento
- Título
- Valor da compra
- Recebimento
- Progresso
- Status

A associação deve utilizar a relação real existente no banco, especialmente `solicitacoes.os_id`.

Não criar relacionamento paralelo.

Quando houver OS vinculada, exibir botão para abrir a OS.

Quando não houver, mostrar `Sem OS vinculada`.

## 6. RECEBIMENTOS PREVISTOS

Transformar o card atual em uma fila operacional.

Exibir solicitações que possuem `previsao_entrega`.

Mostrar:

- solicitação
- fornecedor
- previsão
- valor
- status
- situação temporal

Classificação automática:

### AGENDADO
Data futura normal.

### HOJE
Previsão para a data atual.

### ATRASADO
Previsão menor que a data atual e solicitação ainda não recebida/fechada.

### RECEBIDO
Quando já houver recebimento concluído.

Usar os status existentes do fluxo de Compras.

Destacar visualmente atrasos sem exagerar no uso de cores.

## 7. FILTROS

O filtro superior do Painel de Compras deve continuar sendo a fonte única dos indicadores.

Ao alterar período, busca, setor, prioridade e responsável, os indicadores inferiores devem refletir os mesmos filtros sempre que semanticamente aplicável.

Não criar filtros independentes escondidos nos cards.

## 8. BACK-END

Centralizar a lógica no service/controller existente.

Preferir ampliar `modules/compras/compras.service.js` e o controller correspondente.

Criar funções específicas e legíveis para:

- resumo por status
- resumo financeiro
- custos por solicitação
- OS vinculadas
- recebimentos previstos

Não colocar SQL complexo diretamente dentro do EJS.

O EJS deve apenas renderizar os dados recebidos.

Evitar duplicação de consultas.

## 9. BANCO DE DADOS

Antes de criar migration, verificar o schema real.

Utilizar como fontes oficiais as estruturas existentes de `solicitacoes`, `solicitacao_itens`, `compras_cotacoes`, recebimentos e `estoque_movimentos`.

Somente criar novas colunas/tabelas se forem realmente necessárias para obter custo financeiro confiável.

## 10. FRONT-END

Modernizar somente os quatro blocos inferiores.

Manter identidade visual atual, verde institucional, cards, espaçamento, bordas, tipografia e responsividade.

Estrutura recomendada:

- Linha 1: Solicitações por Status | Custos do Período
- Linha 2: OS Vinculadas | Recebimentos Previstos

Evitar excesso de informação e priorizar leitura rápida.

## 11. GRÁFICOS

Não instalar biblioteca de gráficos sem necessidade.

Antes de adicionar dependência, verificar `package.json`.

Preferir SVG, HTML, CSS e JavaScript vanilla.

Caso o repositório já possua biblioteca adequada, reutilizá-la.

Os gráficos devem ser responsivos.

Não criar gráficos com valores fictícios.

Quando não houver dados, mostrar `Sem dados no período selecionado.`

## 12. FORMATAÇÃO

Moeda em padrão brasileiro:

`R$ 1.250,50`

Percentuais:

`75%`

Datas:

`26/08/2026`

Utilizar funções existentes de formatação quando disponíveis.

## 13. RESPONSIVIDADE

Desktop: duas colunas.

Tablet: duas colunas quando houver espaço.

Celular: uma coluna.

Tabelas devem permitir leitura adequada em celular e botões permanecerem utilizáveis por toque.

## 14. PERMISSÕES

Respeitar o RBAC existente em `config/rbac.js`.

Os novos indicadores devem seguir a mesma permissão da tela de Compras.

Não ampliar acesso nem expor informações financeiras a perfis sem autorização.

## 15. PERFORMANCE

Evitar dezenas de consultas independentes para cada solicitação.

Preferir consultas agregadas, avaliar índices e evitar consultas pesadas em loop.

## 16. COMPATIBILIDADE

A `main` do GitHub pode não refletir exatamente a versão visual atualmente implantada.

Localizar a implementação real do Painel de Compras, localizar os quatro blocos inferiores pelo texto/estrutura, verificar a view/controller que realmente monta os dados e aplicar a alteração no ponto correto.

Não criar uma segunda tela concorrente.

## 17. TESTES

Adicionar testes automatizados quando a arquitetura existente permitir.

Cobrir pelo menos:

1. resumo de solicitações por status;
2. filtro por período;
3. cálculo do total financeiro;
4. cálculo por solicitação;
5. solicitações sem valor;
6. OS vinculada;
7. solicitação sem OS;
8. recebimento previsto;
9. recebimento atrasado;
10. solicitação já recebida;
11. ausência de dados;
12. compatibilidade com banco existente.

Executar:

`npm test`

Também executar smoke tests das rotas envolvidas.

## 18. TESTE MANUAL OBRIGATÓRIO

Validar:

- Agosto/2026 e demais períodos;
- alteração de período;
- solicitação com valor;
- solicitação sem valor;
- recebimento parcial;
- recebimento total;
- solicitação com OS;
- solicitação sem OS;
- previsão vencida;
- ausência de registros.

## 19. NÃO FAZER

Não:

- reescrever todo o módulo Compras;
- remover a tabela principal;
- remover filtros existentes;
- criar tabela paralela para solicitações;
- duplicar rotas;
- duplicar regras de status;
- alterar nomes dos status existentes;
- apagar dados;
- recriar banco;
- instalar biblioteca pesada sem necessidade;
- criar números fictícios;
- esconder inconsistências financeiras;
- quebrar Compras → Almoxarifado → Estoque.

## 20. CRITÉRIOS DE ACEITE

A PR será aceita somente quando os quatro blocos inferiores estiverem modernizados, os gráficos forem reais, os dados financeiros disponíveis forem corretos, o progresso de recebimento estiver presente, OS vinculadas e recebimentos previstos aparecerem corretamente, atrasos forem destacados, os filtros superiores atualizarem os blocos inferiores, o fluxo de Compras continuar funcionando, o banco existente permanecer íntegro, RBAC continuar correto, o layout permanecer responsivo, `npm test` passar e smoke tests passarem.

## 21. ENTREGA DA PR

Criar branch:

`codex/compras-painel-indicadores-financeiros`

Título sugerido:

`feat(compras): modernizar indicadores inferiores e custos do painel`

Antes de alterar qualquer coisa:

ANALISAR → ENTENDER → IMPLEMENTAR LOCALMENTE → TESTAR → VALIDAR FLUXO COMPLETO.

A implementação precisa respeitar o fluxo real:

SOLICITAÇÃO → COMPRAS → RECEBIMENTO → ALMOXARIFADO → ESTOQUE

e, quando aplicável:

OS → SOLICITAÇÃO → COMPRAS.