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
