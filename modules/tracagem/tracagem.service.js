const db = require('../../database/db');

const TIPOS = {
  ROSCA_HELICOIDAL: 'rosca-helicoidal',
  FURACAO_FLANGE: 'furacao-flange',
  CILINDRO: 'cilindro',
  CURVA_GOMOS: 'curva-gomos',
  QUADRADO_PARA_REDONDO: 'quadrado-para-redondo',
  REDUCAO_CONCENTRICA: 'reducao-concentrica',
  SEMI_CILINDRO: 'semi-cilindro',
  BOCA_DE_LOBO_EXCENTRICA: 'boca-de-lobo-excentrica',
  BOCA_DE_LOBO_45: 'boca-de-lobo-45-graus',
  BOCA_DE_LOBO_90: 'boca-de-lobo-90-graus',
  MAO_FRANCESA: 'mao-francesa',
};

function toNum(value, fieldName, { allowZero = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Campo ${fieldName} inválido. Informe um número válido.`);
  if (!allowZero && n <= 0) throw new Error(`Campo ${fieldName} deve ser maior que zero.`);
  return n;
}

function toInt(value, fieldName, { min = 1 } = {}) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < min) throw new Error(`Campo ${fieldName} deve ser um inteiro maior ou igual a ${min}.`);
  return n;
}

function n2(v) {
  return Number(Number(v).toFixed(2));
}

function n4(v) {
  return Number(Number(v).toFixed(4));
}

function emptyPlanificacao() {
  return {
    labels: {},
    pontos: [],
    linhas: [],
    divisoes: [],
  };
}

function buildResult({ entrada, resultado, planificacao, observacoes }) {
  return {
    entrada,
    resultado,
    planificacao: planificacao || emptyPlanificacao(),
    observacoes: observacoes || [],
  };
}

function calcRoscaHelicoidal({ D, d, P }) {
  const Dn = toNum(D, 'D');
  const dn = toNum(d, 'd');
  const Pn = toNum(P, 'P');

  const R1 = Dn / 2;
  const R2 = dn / 2;
  const C = Math.PI * ((Dn + dn) / 4);
  const T = Math.sqrt(((2 * C) ** 2) + (Pn ** 2));
  const planificacao = (360 * C) / Pn;

  return buildResult({
    entrada: { D: Dn, d: dn, P: Pn },
    resultado: {
      R1: n2(R1),
      R2: n2(R2),
      C: n2(C),
      T: n2(T),
      planificacao: n2(planificacao),
    },
    planificacao: {
      labels: { R1: n2(R1), R2: n2(R2), C: n2(C), T: n2(T), P: Pn },
      pontos: [
        { nome: 'A', x: 120, y: 420 },
        { nome: 'B', x: 680, y: 420 },
        { nome: 'C', x: 640, y: 300 },
        { nome: 'D', x: 160, y: 300 },
      ],
      linhas: [
        { de: 'A', para: 'B', tipo: 'base' },
        { de: 'B', para: 'C', tipo: 'geratriz' },
        { de: 'C', para: 'D', tipo: 'topo' },
        { de: 'D', para: 'A', tipo: 'geratriz' },
      ],
      divisoes: [{ indice: 1, descricao: 'passo P', valor: Pn }],
    },
    observacoes: [
      'Resultado prático para marcação de rosca helicoidal em chaparia.',
      'Conferir sentido do avanço e folga de solda antes do corte final.',
    ],
  });
}

function calcFuracaoFlange({ D, N, furos }) {
  const Dn = toNum(D, 'D');
  const Nn = toInt(N ?? furos, 'N');

  const raio = Dn / 2;
  const anguloEntreFuros = 360 / Nn;
  const corda = 2 * raio * Math.sin((Math.PI / Nn));
  const furosCalc = Array.from({ length: Nn }, (_, idx) => {
    const angulo = idx * anguloEntreFuros;
    return {
      furo: idx + 1,
      angulo: n2(angulo),
      x: n2(Math.cos((angulo * Math.PI) / 180) * raio),
      y: n2(Math.sin((angulo * Math.PI) / 180) * raio),
    };
  });

  return buildResult({
    entrada: { D: Dn, N: Nn },
    resultado: {
      raio: n2(raio),
      anguloEntreFuros: n2(anguloEntreFuros),
      corda: n2(corda),
      furos: furosCalc,
    },
    planificacao: {
      labels: { D: Dn, N: Nn, corda: n2(corda), anguloEntreFuros: n2(anguloEntreFuros) },
      pontos: furosCalc.map((f) => ({ nome: `F${f.furo}`, x: f.x, y: f.y })),
      linhas: furosCalc.length > 1 ? [{ de: 'F1', para: 'F2', tipo: 'corda' }] : [],
      divisoes: furosCalc.map((f) => ({ indice: f.furo, angulo: f.angulo })),
    },
    observacoes: [
      'Divisão angular uniforme para furação de flange.',
      'A corda representa a distância linear entre centros de dois furos adjacentes.',
    ],
  });
}

function calcCilindro({ D, h, H, E }) {
  const Dn = toNum(D, 'D');
  const hn = toNum(h ?? H, 'h');
  const En = toNum(E ?? 0, 'E', { allowZero: true });

  const A = Math.PI * Dn;
  const B = hn;

  return buildResult({
    entrada: { D: Dn, h: hn, E: En },
    resultado: {
      A: n2(A),
      B: n2(B),
      comprimento: n2(A),
      comprimentoComFolga: n2(A + (2 * En)),
      area: n2(A * B),
    },
    planificacao: {
      labels: { A: n2(A), B: n2(B), E: En },
      pontos: [
        { nome: 'P1', x: 140, y: 420 },
        { nome: 'P2', x: 660, y: 420 },
        { nome: 'P3', x: 660, y: 260 },
        { nome: 'P4', x: 140, y: 260 },
      ],
      linhas: [
        { de: 'P1', para: 'P2', tipo: 'A' },
        { de: 'P2', para: 'P3', tipo: 'B' },
        { de: 'P3', para: 'P4', tipo: 'A' },
        { de: 'P4', para: 'P1', tipo: 'B' },
      ],
      divisoes: [],
    },
    observacoes: [
      'Desenvolvimento básico para cilindro calandrado.',
      'A = π·D e B = altura útil da chapa.',
    ],
  });
}

function calcCurvaGomos({ D, A, G, diametro, angulo, gomos }) {
  const Dn = toNum(D ?? diametro, 'D');
  const An = toNum(A ?? angulo, 'A');
  const Gn = toInt(G ?? gomos, 'G');

  const anguloPorGomo = An / Gn;
  const anguloCorte = anguloPorGomo / 2;
  const desenvolvimentoBase = Math.PI * Dn;
  const comprimentoAproximado = desenvolvimentoBase / Gn;

  const divisoes = Array.from({ length: Gn + 1 }, (_, i) => ({
    indice: i,
    medida: n2((desenvolvimentoBase / Gn) * i),
  }));

  return buildResult({
    entrada: { D: Dn, A: An, G: Gn },
    resultado: {
      anguloPorGomo: n2(anguloPorGomo),
      anguloCorte: n2(anguloCorte),
      desenvolvimentoBase: n2(desenvolvimentoBase),
      comprimentoAproximado: n2(comprimentoAproximado),
    },
    planificacao: {
      labels: { A: An, P: n2(anguloPorGomo), D: Dn },
      pontos: [],
      linhas: [],
      divisoes,
    },
    observacoes: [
      'Ângulo de corte aproximado por gomo.',
      'Resultado inicial para traçagem prática de curva segmentada.',
    ],
  });
}

function calcQuadradoParaRedondo({ L, D, H, lado, diametro, altura }) {
  const Ln = toNum(L ?? lado, 'L');
  const Dn = toNum(D ?? diametro, 'D');
  const Hn = toNum(H ?? altura, 'H');

  const perimetroQuadrado = Ln * 4;
  const circunferenciaRedondo = Math.PI * Dn;
  const geratrizAproximada = Math.sqrt((Hn * Hn) + ((((Ln - Dn) / 2) || 0) ** 2));

  const setores = Array.from({ length: 4 }, (_, idx) => ({
    indice: idx + 1,
    medida: n2(circunferenciaRedondo / 4),
  }));

  return buildResult({
    entrada: { L: Ln, D: Dn, H: Hn },
    resultado: {
      perimetroQuadrado: n2(perimetroQuadrado),
      circunferenciaRedondo: n2(circunferenciaRedondo),
      geratrizAproximada: n2(geratrizAproximada),
    },
    planificacao: {
      labels: { AA: n2(Ln), AB: n2(Dn), C: n2(geratrizAproximada) },
      pontos: [],
      linhas: [],
      divisoes: setores,
    },
    observacoes: [
      'Resultado aproximado para transição quadrado-redondo.',
      'Ideal para marcação inicial e conferência de oficina.',
    ],
  });
}

function calcReducaoConcentrica({ D1, D2, H, dMaior, dMenor, altura }) {
  const D1n = toNum(D1 ?? dMaior, 'D1');
  const D2n = toNum(D2 ?? dMenor, 'D2');
  const Hn = toNum(H ?? altura, 'H');

  const R1 = D1n / 2;
  const R2 = D2n / 2;
  const diferencaRaios = R1 - R2;
  const geratriz = Math.sqrt((Hn * Hn) + (diferencaRaios ** 2));

  return buildResult({
    entrada: { D1: D1n, D2: D2n, H: Hn },
    resultado: {
      R1: n2(R1),
      R2: n2(R2),
      diferencaRaios: n2(diferencaRaios),
      geratriz: n2(geratriz),
    },
    planificacao: emptyPlanificacao(),
    observacoes: [
      'Cálculo base para tronco de cone concêntrico.',
      'Usar geratriz para planificação e corte.',
    ],
  });
}

function calcSemiCilindro({ D, H, E, diametro, comprimento }) {
  const Dn = toNum(D ?? diametro, 'D');
  const Hn = toNum(H ?? comprimento, 'H');
  const En = toNum(E ?? 0, 'E', { allowZero: true });

  const meiaCircunferencia = (Math.PI * Dn) / 2;
  const area = meiaCircunferencia * Hn;

  return buildResult({
    entrada: { D: Dn, H: Hn, E: En },
    resultado: {
      meiaCircunferencia: n2(meiaCircunferencia),
      area: n2(area),
    },
    planificacao: emptyPlanificacao(),
    observacoes: [
      'Desenvolvimento aproximado de semi-cilindro.',
      'Não inclui sobra de solda.',
    ],
  });
}

function calcBocaLoboExcentrica({ D1, D2, X, H, dPrincipal, dDerivacao, deslocamento, altura }) {
  const D1n = toNum(D1 ?? dPrincipal, 'D1');
  const D2n = toNum(D2 ?? dDerivacao, 'D2');
  const Xn = toNum(X ?? deslocamento, 'X');
  const Hn = toNum(H ?? altura ?? 0, 'H', { allowZero: true });

  const R1 = D1n / 2;
  const R2 = D2n / 2;
  const diferenca = Math.abs(R1 - R2);
  const geratrizAproximada = Math.sqrt((Hn * Hn) + (Xn * Xn) + (diferenca ** 2));

  return buildResult({
    entrada: { D1: D1n, D2: D2n, X: Xn, H: Hn },
    resultado: {
      R1: n2(R1),
      R2: n2(R2),
      deslocamento: n2(Xn),
      geratrizAproximada: n2(geratrizAproximada),
    },
    planificacao: emptyPlanificacao(),
    observacoes: [
      'Cálculo aproximado para boca de lobo excêntrica.',
      'Indicado para traçagem inicial e conferência prática.',
    ],
  });
}

function calcBocaLobo45({ D, H, dPrincipal, altura }) {
  const Dn = toNum(D ?? dPrincipal, 'D');
  const Hn = toNum(H ?? altura ?? 0, 'H', { allowZero: true });

  const desenvolvimento = Math.PI * Dn;
  const fatorCorte = Math.sin((45 * Math.PI) / 180);

  return buildResult({
    entrada: { D: Dn, H: Hn },
    resultado: {
      angulo: 45,
      desenvolvimento: n2(desenvolvimento),
      fatorCorte: n4(fatorCorte),
    },
    planificacao: emptyPlanificacao(),
    observacoes: [
      'Perfil de corte para boca de lobo a 45 graus.',
      'Usar como base para marcação da interseção.',
    ],
  });
}

function calcBocaLobo90({ D1, D2, dPrincipal, dDerivacao }) {
  const D1n = toNum(D1 ?? dPrincipal, 'D1');
  const D2n = toNum(D2 ?? dDerivacao, 'D2');

  const R1 = D1n / 2;
  const R2 = D2n / 2;
  const desenvolvimentoPrincipal = Math.PI * D1n;
  const desenvolvimentoSecundario = Math.PI * D2n;

  return buildResult({
    entrada: { D1: D1n, D2: D2n },
    resultado: {
      R1: n2(R1),
      R2: n2(R2),
      desenvolvimentoPrincipal: n2(desenvolvimentoPrincipal),
      desenvolvimentoSecundario: n2(desenvolvimentoSecundario),
    },
    planificacao: emptyPlanificacao(),
    observacoes: [
      'Cálculo base para interseção de tubos em 90 graus.',
      'Usar para marcação da curva de boca de lobo.',
    ],
  });
}

function calcMaoFrancesa({ A, h, E, base, altura, largura, comprimento }) {
  const An = toNum(A ?? base ?? largura, 'A');
  const hn = toNum(h ?? altura ?? comprimento, 'h');
  const En = toNum(E ?? 0, 'E', { allowZero: true });

  const C = Math.sqrt((An ** 2) + (hn ** 2));
  const alpha = (Math.atan2(hn, An) * 180) / Math.PI;

  return buildResult({
    entrada: { A: An, h: hn, E: En },
    resultado: {
      C: n2(C),
      alpha: n2(alpha),
      B: n2(En),
      D: n2(En),
      diagonal: n2(C),
    },
    planificacao: {
      labels: { A: An, h: hn, E: En, C: n2(C), B: n2(En), D: n2(En), alpha: n2(alpha) },
      pontos: [
        { nome: 'A', x: 90, y: 320 },
        { nome: 'B', x: 310, y: 320 },
        { nome: 'C', x: 90, y: 120 },
      ],
      linhas: [
        { de: 'A', para: 'B', tipo: 'A' },
        { de: 'A', para: 'C', tipo: 'h' },
        { de: 'C', para: 'B', tipo: 'C' },
      ],
      divisoes: [],
    },
    observacoes: [
      'Diagonal calculada por Pitágoras para corte da barra inclinada.',
      'Ângulo α medido em relação à base A.',
    ],
  });
}

function calcularPorTipo(tipo, params) {
  switch (tipo) {
    case TIPOS.ROSCA_HELICOIDAL:
      return calcRoscaHelicoidal(params);
    case TIPOS.FURACAO_FLANGE:
      return calcFuracaoFlange(params);
    case TIPOS.CILINDRO:
      return calcCilindro(params);
    case TIPOS.CURVA_GOMOS:
      return calcCurvaGomos(params);
    case TIPOS.QUADRADO_PARA_REDONDO:
      return calcQuadradoParaRedondo(params);
    case TIPOS.REDUCAO_CONCENTRICA:
      return calcReducaoConcentrica(params);
    case TIPOS.SEMI_CILINDRO:
      return calcSemiCilindro(params);
    case TIPOS.BOCA_DE_LOBO_EXCENTRICA:
      return calcBocaLoboExcentrica(params);
    case TIPOS.BOCA_DE_LOBO_45:
      return calcBocaLobo45(params);
    case TIPOS.BOCA_DE_LOBO_90:
      return calcBocaLobo90(params);
    case TIPOS.MAO_FRANCESA:
    case 'pao-francesa':
      return calcMaoFrancesa(params);
    default:
      throw new Error('Tipo de traçagem inválido.');
  }
}

function salvar({ tipo, titulo, equipamento_id, os_id, usuario_id, parametros, resultado }) {
  const info = db.prepare(`
    INSERT INTO tracagens (
      tipo, titulo, equipamento_id, os_id, usuario_id, parametros_json, resultado_json, updated_at
    ) VALUES (
      @tipo, @titulo, @equipamento_id, @os_id, @usuario_id, @parametros_json, @resultado_json, datetime('now')
    )
  `).run({
    tipo,
    titulo: titulo || null,
    equipamento_id: equipamento_id || null,
    os_id: os_id || null,
    usuario_id: usuario_id || null,
    parametros_json: JSON.stringify(parametros || {}),
    resultado_json: JSON.stringify(resultado || {}),
  });

  return Number(info.lastInsertRowid);
}

function getById(id) {
  const row = db.prepare(`
    SELECT t.*, u.name AS usuario_nome, o.id AS os_codigo, e.nome AS equipamento_nome
    FROM tracagens t
    LEFT JOIN users u ON u.id = t.usuario_id
    LEFT JOIN os o ON o.id = t.os_id
    LEFT JOIN equipamentos e ON e.id = t.equipamento_id
    WHERE t.id = ?
  `).get(Number(id));

  if (!row) return null;

  return {
    ...row,
    parametros: JSON.parse(row.parametros_json || '{}'),
    resultado: JSON.parse(row.resultado_json || '{}'),
  };
}

function list({ tipo, equipamento_id, os_id, periodo_inicio, periodo_fim } = {}) {
  const where = ['1=1'];
  const params = {};

  if (tipo) {
    where.push('t.tipo = @tipo');
    params.tipo = tipo;
  }
  if (equipamento_id) {
    where.push('t.equipamento_id = @equipamento_id');
    params.equipamento_id = Number(equipamento_id);
  }
  if (os_id) {
    where.push('t.os_id = @os_id');
    params.os_id = Number(os_id);
  }
  if (periodo_inicio) {
    where.push("date(t.created_at) >= date(@periodo_inicio)");
    params.periodo_inicio = periodo_inicio;
  }
  if (periodo_fim) {
    where.push("date(t.created_at) <= date(@periodo_fim)");
    params.periodo_fim = periodo_fim;
  }

  return db.prepare(`
    SELECT t.id, t.tipo, t.titulo, t.created_at,
           e.nome AS equipamento_nome,
           o.id AS os_codigo,
           u.name AS usuario_nome
    FROM tracagens t
    LEFT JOIN equipamentos e ON e.id = t.equipamento_id
    LEFT JOIN os o ON o.id = t.os_id
    LEFT JOIN users u ON u.id = t.usuario_id
    WHERE ${where.join(' AND ')}
    ORDER BY datetime(t.created_at) DESC
  `).all(params);
}

function listByOS(osId) {
  return db.prepare(`
    SELECT id, tipo, titulo, created_at
    FROM tracagens
    WHERE os_id = ?
    ORDER BY datetime(created_at) DESC
  `).all(Number(osId));
}

function listByEquipamento(equipamentoId) {
  return db.prepare(`
    SELECT id, tipo, titulo, created_at
    FROM tracagens
    WHERE equipamento_id = ?
    ORDER BY datetime(created_at) DESC
  `).all(Number(equipamentoId));
}

function listEquipamentos() {
  return db.prepare('SELECT id, nome FROM equipamentos ORDER BY nome ASC').all();
}

function listOSAbertas() {
  return db.prepare('SELECT id, status FROM os ORDER BY id DESC LIMIT 200').all();
}

module.exports = {
  TIPOS,
  calcRoscaHelicoidal,
  calcFuracaoFlange,
  calcCilindro,
  calcCurvaGomos,
  calcQuadradoParaRedondo,
  calcReducaoConcentrica,
  calcSemiCilindro,
  calcBocaLoboExcentrica,
  calcBocaLobo45,
  calcBocaLobo90,
  calcMaoFrancesa,
  calcularPorTipo,
  salvar,
  getById,
  list,
  listByOS,
  listByEquipamento,
  listEquipamentos,
  listOSAbertas,
};
