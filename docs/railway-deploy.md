# Deploy no Railway + agregação no Helioway

Este guia prepara o sistema para rodar **no Railway** (hospedagem) e ser agregado depois no **Helioway** por link/menu.

## 1) Variáveis mínimas no Railway

- `SESSION_SECRET` (obrigatória)
- `DB_PATH=/data/app.db`
- `UPLOADS_DIR=/data/uploads`
- `PORT` (normalmente injetada pelo Railway)

## 2) Pré-check automatizado

```bash
npm run preflight:railway
```

O check valida:
- Node.js >= 18
- sessão segura
- paths de banco/uploads
- presença de start script com migração
- indícios de execução no Railway (`RAILWAY_*`)

## 3) Start recomendado

```bash
npm ci && npm run migrate && npm start
```

> O `npm start` atual já executa migrations antes do `server.js`.

## 4) Como plugar no Helioway (depois)

1. Publicar esta aplicação no Railway com health check em `/health`.
2. Criar item de menu no Helioway apontando para a URL pública do Railway.
3. Evoluir para SSO/menu único quando a autenticação central estiver pronta.

## 5) Estado atual

- Aplicação pronta para deploy no Railway.
- Login ainda local (`/auth/login`).
- RBAC interno já ativo por `role`.
