# PCM — Etapas 1 e 2 + Implementação inicial da Etapa 3

## 1) Diagnóstico do que já existe

### Arquitetura e stack
- Backend em **Node.js + Express** com renderização server-side em **EJS**.
- Banco em **SQLite (better-sqlite3)** com pipeline de migrations SQL/JS.
- Módulos já separados por domínio (`modules/<dominio>/{routes,controller,service}`), mantendo padrão modular.

### Módulos existentes mapeados
- Núcleo industrial: `os`, `pcm`, `preventivas`, `equipamentos`, `estoque`, `almoxarifado`, `compras`, `solicitacoes`, `escala`, `inspecao`.
- Apoio: `dashboard`, `avisos`, `usuarios`, `auth`, `demandas`, `motores`, `tracagem`, `desenho-tecnico`.

### Banco de dados e migrations existentes
- Base de OS em `030_os.sql` + incrementos de execução/fechamento e autoalocação.
- Estruturas de almox/estoque em `080+`, com retiradas em `081_retiradas_almox.sql` e `086_almox_solicitacoes_integracao.sql`.
- Estruturas de escala/colaborador em `060_escala.sql` e evoluções (`118`, `119`).
- PCM com base em `091_pcm_plano_mestre.sql` e fundações adicionais nas migrations `111+`.

### RBAC/permissões
- Matriz centralizada em `config/rbac.js`.
- O módulo PCM já possui chave dedicada (`ACCESS.pcm`) e controle por middleware `requireRole`.

### Views e padrão visual
- Layout único `views/layout.ejs` com sidebar/topbar padrão Campo do Gado.
- PCM já padronizado com `views/pcm/partials/internal-nav.ejs` e `internal-styles.ejs`.
- Estrutura mobile/tablet já contemplada nesses estilos.

### Reaproveitamentos possíveis (identificados)
1. Dados de execução por técnico via tabela `os` usando `executor_colaborador_id` e `auxiliar_colaborador_id`.
2. Custo por OS já disponível via `os.custo_total`.
3. Histórico por equipamento via join `os.equipamento_id -> equipamentos.id`.
4. Materiais aplicados por colaborador via `almox_retiradas.created_by` + `estoque_itens.custo_medio`.
5. Navegação PCM interna já pronta para novas seções.

### Pontos fracos/riscos
- Algumas telas PCM ainda em placeholder (`TODO`) e sem persistência final.
- Nomenclatura histórica com convivência de tabelas antigas/novas pode gerar acoplamento se não houver fallback.
- Métricas de mão de obra ainda sem custo-hora oficial por colaborador (estimativa atual é operacional).

---

## 2) Plano de evolução (baseado no que já existe)

### O que será aproveitado
- Estrutura modular do PCM (routes/controller/service).
- Menu interno PCM + estilos atuais.
- Tabelas `os`, `equipamentos`, `colaboradores`, `almox_retiradas`, `estoque_itens`.

### O que será alterado
- Serviço PCM para agregar métricas de perfil técnico do colaborador.
- Controller PCM para disponibilizar nova tela integrada.
- Rotas PCM para nova funcionalidade.
- Navegação interna PCM para acesso da nova visão.

### O que será criado
- Nova view EJS: **Perfil Técnico do Colaborador**.
- Documento técnico desta etapa.

### Ordem ideal de implementação
1. Criar consultas no service (base de dados já existente).
2. Expor rota/controller.
3. Criar view integrada ao padrão visual.
4. Validar regressão com testes existentes.
5. Evoluir em etapas futuras com custo/hora, retrabalho e apontamento de material por OS.

---

## 3) Implementação técnica executada nesta etapa

### Funcionalidade entregue
- Nova seção PCM: **`/pcm/perfil-tecnico-colaborador`**.
- Entregas da visão:
  - histórico de OS executadas (executor/auxiliar)
  - equipamentos em que mais atuou
  - materiais retirados no almoxarifado
  - custo estimado dos materiais
  - horas totais e MTTR médio
  - produtividade operacional (OS/h)
  - linha do tempo de serviços

### Estratégia de integração
- Sem criar novas tabelas/migrations nesta etapa.
- Uso de joins e agregações sobre entidades já existentes.
- Reuso integral do padrão visual PCM já adotado.

---

## 4) Instruções de aplicação
1. Rodar migrações normalmente (já existentes do projeto).
2. Subir aplicação.
3. Acessar: `/pcm/perfil-tecnico-colaborador`.
4. Filtrar por colaborador e período para visualizar indicadores.

---

## 5) Próximas melhorias recomendadas
1. **Custo de mão de obra real**: incluir custo-hora por colaborador e cálculo por OS.
2. **Retrabalho**: adicionar sinalização explícita de OS reaberta/recorrente por falha.
3. **Materiais por OS**: vincular retiradas de almox diretamente ao ID da OS para rastreabilidade total.
4. **Histórico por equipamento (Etapa B)**: painel espelho com foco no ativo (MTTR, recorrência, custos).
5. **Indicadores executivos (Etapa C)**: custo por setor/tipo de falha/ranking técnico com filtros avançados.
