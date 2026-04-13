#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const hasDataDir = fs.existsSync('/data');
const checks = [];

function add(status, name, detail) {
  checks.push({ status, name, detail });
}

const dbPath = process.env.DB_PATH || (hasDataDir ? '/data/app.db' : path.join(root, 'database.sqlite'));
const uploadsDir = process.env.UPLOADS_DIR || (hasDataDir ? '/data/uploads' : path.join(root, 'uploads'));
const sessionSecret = process.env.SESSION_SECRET;
const nodeVersion = process.versions.node;
const railwayEnvDetected = Object.keys(process.env).some((k) => k.startsWith('RAILWAY_'));

if (fs.existsSync(path.join(root, 'server.js'))) {
  add('ok', 'server.js', 'Aplicação Express encontrada.');
} else {
  add('fail', 'server.js', 'Arquivo principal não encontrado no diretório atual.');
}

const major = Number(nodeVersion.split('.')[0] || 0);
if (major >= 18) add('ok', 'Node.js', `Versão compatível detectada: v${nodeVersion}`);
else add('fail', 'Node.js', `Versão incompatível: v${nodeVersion}. Necessário >= 18.`);

if (sessionSecret && sessionSecret.length >= 16) {
  add('ok', 'SESSION_SECRET', 'Configurado com tamanho adequado.');
} else if (sessionSecret) {
  add('warn', 'SESSION_SECRET', 'Configurado, mas recomendado usar pelo menos 16 caracteres.');
} else {
  add('fail', 'SESSION_SECRET', 'Não definido. Configure no Railway para evitar sessão insegura.');
}

if (process.env.DB_PATH) add('ok', 'DB_PATH', `Definido explicitamente: ${dbPath}`);
else add('warn', 'DB_PATH', `Não definido, usando fallback: ${dbPath}`);

if (process.env.UPLOADS_DIR) add('ok', 'UPLOADS_DIR', `Definido explicitamente: ${uploadsDir}`);
else add('warn', 'UPLOADS_DIR', `Não definido, usando fallback: ${uploadsDir}`);

const uploadsParent = path.dirname(uploadsDir);
if (fs.existsSync(uploadsParent)) {
  add('ok', 'Persistência de upload', `Diretório base visível: ${uploadsParent}`);
} else {
  add('warn', 'Persistência de upload', `Diretório base ainda não existe (${uploadsParent}); o app tentará criar no boot.`);
}

if (railwayEnvDetected) add('ok', 'Railway', 'Variáveis RAILWAY_* detectadas (execução no Railway).');
else add('warn', 'Railway', 'Variáveis RAILWAY_* não detectadas (provável execução local).');

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) {
  add('fail', 'package.json', 'package.json não encontrado.');
} else {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const startScript = pkg?.scripts?.start || '';
  if (/migrate/.test(startScript) && /server\.js/.test(startScript)) {
    add('ok', 'Start script', `Script de start com migração automática: "${startScript}"`);
  } else {
    add('warn', 'Start script', `Script atual: "${startScript}". Recomenda-se rodar migração antes do servidor.`);
  }
}

console.log('\n=== Pré-check Railway ===');
for (const c of checks) {
  const icon = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
  console.log(`${icon} ${c.name}: ${c.detail}`);
}

const failures = checks.filter((c) => c.status === 'fail').length;
if (failures > 0) {
  console.log(`\nResultado: ${failures} falha(s) crítica(s). Corrija antes do deploy no Railway.`);
  process.exit(1);
}

console.log('\nResultado: ambiente apto para deploy inicial no Railway.');
