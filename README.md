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
