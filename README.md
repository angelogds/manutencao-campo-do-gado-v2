# Manutenção Campo do Gado — V2

Sistema V2 modular para gestão de manutenção e rotinas operacionais do **Campo do Gado – Indústria de Reciclagem Animal LTDA**.

Este repositório segue um padrão rígido para acelerar evolução sem retrabalho:
- módulos independentes (`routes/controller/service`)
- migrations/seed padronizados
- RBAC por `role`
- UI com EJS (layout + parciais)
- SQLite (better-sqlite3)

> **Regra de ouro:** qualquer alteração/feature deve seguir o `CODING_RULES.md`.

---

## Tecnologias
- Node.js + Express
- EJS + ejs-mate
- SQLite (`better-sqlite3`)
- Sessão: `express-session` + `connect-flash`

---

## Como rodar localmente

### 1) Instalar dependências
```bash
npm install

### 2) Rodar migrations e seed
```bash
npm run migrate
npm run seed
```

### 3) Subir aplicação
```bash
npm run dev
```

## Novo módulo: Desenho Técnico

### Rotas principais
- `GET /desenho-tecnico` — lista de desenhos
- `GET /desenho-tecnico/dashboard` — visão geral do módulo
- `GET /desenho-tecnico/novo` — criação de novo desenho
- `POST /desenho-tecnico` — salvar desenho
- `GET /desenho-tecnico/:id` — visualizar desenho
- `GET /desenho-tecnico/:id/editar` — editar desenho
- `POST /desenho-tecnico/:id` — atualizar desenho
- `POST /desenho-tecnico/:id/duplicar` — duplicar desenho
- `GET /desenho-tecnico/:id/svg` — gerar SVG técnico
- `POST /desenho-tecnico/:id/pdf` — gerar PDF técnico
- `POST /desenho-tecnico/:id/vincular` — vincular desenho em equipamento
- `GET /desenho-tecnico/:id/revisoes` — histórico de revisões
- `GET /desenho-tecnico/biblioteca` — biblioteca técnica

### Railway (deploy)
1. Configurar `DB_PATH=/data/app.db` no serviço.
2. Garantir volume persistente montado em `/data`.
3. Start command recomendado:
   ```bash
   npm ci && npm run migrate && npm start
   ```
4. O módulo gera PDFs em `/data/uploads/desenho-tecnico-pdf` automaticamente quando o volume está configurado.

### Novo Desenho CAD (Fase 3)

O módulo **Desenho Técnico** agora possui dois fluxos:
- **Novo Desenho**: paramétrico (gerado por medidas).
- **Novo Desenho CAD**: desenho manual 2D em editor SVG com camadas, cotas básicas, grade/snap e prévia 3D simples por extrusão.

#### Rotas CAD
- `GET /desenho-tecnico/cad/novo`
- `POST /desenho-tecnico/cad`
- `GET /desenho-tecnico/cad/:id`
- `POST /desenho-tecnico/cad/:id`
- `GET /desenho-tecnico/cad/:id/editor`
- `POST /desenho-tecnico/cad/:id/objeto`
- `POST /desenho-tecnico/cad/:id/render-3d`
- `GET /desenho-tecnico/cad/:id/pdf`

#### Persistência CAD
- Campos adicionados em `desenhos_tecnicos`: `tipo_origem`, `modo_cad_ativo`, `json_cad`, `json_3d`, `preview_3d_path`.
- Nova tabela `desenho_cad_objetos` para espelho dos elementos do editor.
- Nova tabela `desenho_cad_historico` para rastreabilidade e base para undo/redo persistente.

#### PDF + 3D
- PDF técnico agora indica o **modo** (Paramétrico/CAD).
- Quando houver extrusão compatível, o PDF inclui resumo da prévia 3D simplificada.

#### Como testar local e Railway
1. `npm run migrate`
2. `npm run dev`
3. Acessar `Desenho Técnico > Novo Desenho CAD`.
4. Desenhar no editor, salvar e testar renderização 3D.
5. No Railway, manter `DB_PATH=/data/app.db` e volume em `/data`.
