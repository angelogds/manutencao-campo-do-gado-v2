const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDbPath = path.join(os.tmpdir(), `preventivas-responsaveis-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = tempDbPath;

const db = require('../database/db');
const service = require('../modules/preventivas/preventivas.service');

function resetSchema() {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TRIGGER IF EXISTS trg_os_preventiva_responsaveis_padrao;
    DROP TABLE IF EXISTS preventiva_responsaveis_padrao;
    DROP TABLE IF EXISTS preventiva_execucoes;
    DROP TABLE IF EXISTS preventiva_planos;
    DROP TABLE IF EXISTS os;
    DROP TABLE IF EXISTS colaboradores;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    );

    CREATE TABLE colaboradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      funcao TEXT,
      user_id INTEGER,
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE preventiva_planos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipamento_id INTEGER,
      titulo TEXT NOT NULL,
      frequencia_tipo TEXT NOT NULL DEFAULT 'semanal',
      frequencia_valor INTEGER NOT NULL DEFAULT 1,
      ativo INTEGER NOT NULL DEFAULT 1,
      observacao TEXT
    );

    CREATE TABLE preventiva_execucoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plano_id INTEGER,
      data_prevista TEXT,
      data_executada TEXT,
      status TEXT,
      responsavel TEXT,
      observacao TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE os (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipamento TEXT,
      descricao TEXT,
      tipo TEXT,
      status TEXT,
      executor_colaborador_id INTEGER,
      auxiliar_colaborador_id INTEGER,
      mecanico_user_id INTEGER,
      auxiliar_user_id INTEGER,
      alocacao_modo TEXT,
      alocado_em TEXT
    );
    PRAGMA foreign_keys = ON;
  `);

  const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '126_preventiva_responsaveis_sync.sql');
  db.exec(fs.readFileSync(migrationPath, 'utf8'));
}

function addColaborador(nome) {
  const user = db.prepare(`INSERT INTO users (name) VALUES (?)`).run(nome);
  const userId = Number(user.lastInsertRowid);
  const colab = db.prepare(`INSERT INTO colaboradores (nome, funcao, user_id, ativo) VALUES (?, 'mecanico', ?, 1)`).run(nome, userId);
  return { id: Number(colab.lastInsertRowid), user_id: userId, nome };
}

test('trocar responsáveis atualiza preventivas pendentes e OS preventivas abertas, sem mexer em andamento', () => {
  resetSchema();
  const salviano = addColaborador('Salviano');
  const junior = addColaborador('Júnior');
  const luiz = addColaborador('Luiz');

  const plano = db.prepare(`INSERT INTO preventiva_planos (titulo) VALUES ('Verificação semanal')`).run();
  const planoId = Number(plano.lastInsertRowid);

  const execPendente = db.prepare(`
    INSERT INTO preventiva_execucoes (plano_id, status, responsavel)
    VALUES (?, 'pendente', 'Salviano')
  `).run(planoId);
  const execExecutada = db.prepare(`
    INSERT INTO preventiva_execucoes (plano_id, status, responsavel, data_executada)
    VALUES (?, 'executada', 'Salviano', '2026-08-23')
  `).run(planoId);

  const osAberta = db.prepare(`
    INSERT INTO os (equipamento, descricao, tipo, status, executor_colaborador_id, mecanico_user_id)
    VALUES ('ROSCA', 'Preventiva', 'PREVENTIVA', 'ABERTA', ?, ?)
  `).run(salviano.id, salviano.user_id);

  const osAndamento = db.prepare(`
    INSERT INTO os (equipamento, descricao, tipo, status, executor_colaborador_id, mecanico_user_id)
    VALUES ('PRENSA', 'Preventiva', 'PREVENTIVA', 'ANDAMENTO', ?, ?)
  `).run(salviano.id, salviano.user_id);

  const osCorretiva = db.prepare(`
    INSERT INTO os (equipamento, descricao, tipo, status, executor_colaborador_id, mecanico_user_id)
    VALUES ('MOINHO', 'Corretiva', 'CORRETIVA', 'ABERTA', ?, ?)
  `).run(salviano.id, salviano.user_id);

  const result = service.saveResponsaveisPadrao({
    mecanico1Id: junior.id,
    mecanico2Id: luiz.id,
  });

  assert.equal(result.responsavel_label, 'Júnior e Luiz');
  assert.equal(result.osAtualizadas, 1);
  assert.equal(result.execucoesAtualizadas, 1);

  const pendente = db.prepare(`SELECT * FROM preventiva_execucoes WHERE id = ?`).get(Number(execPendente.lastInsertRowid));
  const executada = db.prepare(`SELECT * FROM preventiva_execucoes WHERE id = ?`).get(Number(execExecutada.lastInsertRowid));
  assert.equal(pendente.responsavel, 'Júnior e Luiz');
  assert.equal(executada.responsavel, 'Salviano');

  const aberta = db.prepare(`SELECT * FROM os WHERE id = ?`).get(Number(osAberta.lastInsertRowid));
  assert.equal(aberta.executor_colaborador_id, junior.id);
  assert.equal(aberta.auxiliar_colaborador_id, luiz.id);
  assert.equal(aberta.mecanico_user_id, junior.user_id);
  assert.equal(aberta.auxiliar_user_id, luiz.user_id);

  const andamento = db.prepare(`SELECT * FROM os WHERE id = ?`).get(Number(osAndamento.lastInsertRowid));
  assert.equal(andamento.executor_colaborador_id, salviano.id);
  assert.equal(andamento.auxiliar_colaborador_id, null);

  const corretiva = db.prepare(`SELECT * FROM os WHERE id = ?`).get(Number(osCorretiva.lastInsertRowid));
  assert.equal(corretiva.executor_colaborador_id, salviano.id);
});

test('nova OS preventiva recebe automaticamente a dupla configurada pelo trigger', () => {
  resetSchema();
  const junior = addColaborador('Júnior');
  const luiz = addColaborador('Luiz');

  service.saveResponsaveisPadrao({ mecanico1Id: junior.id, mecanico2Id: luiz.id });

  const nova = db.prepare(`
    INSERT INTO os (equipamento, descricao, tipo, status)
    VALUES ('DECANTER', 'Preventiva semanal', 'PREVENTIVA', 'ABERTA')
  `).run();

  const row = db.prepare(`SELECT * FROM os WHERE id = ?`).get(Number(nova.lastInsertRowid));
  assert.equal(row.executor_colaborador_id, junior.id);
  assert.equal(row.auxiliar_colaborador_id, luiz.id);
  assert.equal(row.mecanico_user_id, junior.user_id);
  assert.equal(row.auxiliar_user_id, luiz.user_id);
  assert.equal(row.alocacao_modo, 'AUTO');
  assert.ok(row.alocado_em);
});
