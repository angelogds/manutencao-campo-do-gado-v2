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

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function r2(v) {
  return Number(v || 0).toFixed(2);
}

function calcRoscaHelicoidal({ D, d, P }) {
  const Dn = Number(D);
  const dn = Number(d);
  const Pn = Number(P);

  const R1 = Dn / 2;
  const R2 = dn / 2;
  const C = (Math.PI * (R1 + R2)) / 2;
  const T = Math.sqrt((Math.PI * (R1 + R2)) ** 2 + Pn ** 2);

  return {
    entrada: { D: Dn, d: dn, P: Pn },
    resultado: {
      R1: Number(R1.toFixed(2)),
      R2: Number(R2.toFixed(2)),
      C: Number(C.toFixed(2)),
      T: Number(T.toFixed(2)),
    },
    observacoes: [
      'Cálculo aproximado para planificação de rosca helicoidal.',
    ],
  };
}

function calcFuracaoFlange({ D, N, furos }) {
  const Dn = Number(D);
  const Nn = Number(N || furos);

  const raio = Dn / 2;
  const angulo = 360 / Nn;

  const listaFuros = [];
  for (let i = 0; i < Nn; i += 1) {
    listaFuros.push({
      furo: i + 1,
      angulo: Number((i * angulo).toFixed(2)),
    });
  }

  return {
    entrada: { D: Dn, N: Nn },
    resultado: {
      raio: Number(raio.toFixed(2)),
      anguloEntreFuros: Number(angulo.toFixed(2)),
      furos: listaFuros,
    },
    observacoes: [
      'Furos distribuídos uniformemente na circunferência.',
    ],
  };
}

function calcCilindro({ D, h, E }) {
  const Dn = Number(D);
  const hn = Number(h);
  const En = Number(E || 0);

  const comprimento = Math.PI * Dn;
  const area = comprimento * hn;

  return {
    entrada: { D: Dn, h: hn, E: En },
    resultado: {
      comprimento: Number(comprimento.toFixed(2)),
      area: Number(area.toFixed(2)),
    },
    observacoes: [
      'Comprimento calculado sem folga de solda.',
    ],
  };
}

function calcCurvaGomos({ diametro, angulo, gomos }) {
  const d = toNum(diametro);
  const a = toNum(angulo);
  const nGomos = Math.max(parseInt(gomos, 10) || 1, 1);

  const anguloPorGomo = a / nGomos;
  const arcoTotal = (Math.PI * d * a) / 360;
  const desenvolvimentoGomo = arcoTotal / nGomos;

  return {
    angulo_por_gomo: r2(anguloPorGomo),
    desenvolvimento_gomo: r2(desenvolvimentoGomo),
    desenvolvimento_total: r2(arcoTotal),
    medidas_aproximadas_fabricacao: `Cortar ${nGomos} gomos com ângulo de ${r2(anguloPorGomo)}° cada.`,
  };
}

function calcQuadradoParaRedondo({ lado, diametro, altura }) {
  const l = toNum(lado);
  const d = toNum(diametro);
  const h = toNum(altura);
  const perimetroQuadrado = 4 * l;
  const perimetroRedondo = Math.PI * d;
  const transicao = Math.sqrt(((l - d) / 2) ** 2 + h ** 2);
  return {
    perimetro_quadrado: r2(perimetroQuadrado),
    perimetro_redondo: r2(perimetroRedondo),
    geratriz_aproximada: r2(transicao),
    observacao_tecnica: 'Dividir em 4 pétalas para facilitar planificação da transição.',
  };
}

function calcReducaoConcentrica({ dMaior, dMenor, altura }) {
  const D = toNum(dMaior);
  const d = toNum(dMenor);
  const h = toNum(altura);
  const geratriz = Math.sqrt(((D - d) / 2) ** 2 + h ** 2);
  const desenvolvimentoMaior = Math.PI * D;
  const desenvolvimentoMenor = Math.PI * d;
  return {
    geratriz: r2(geratriz),
    desenvolvimento_maior: r2(desenvolvimentoMaior),
    desenvolvimento_menor: r2(desenvolvimentoMenor),
    observacao_tecnica: 'Aplicar folga de solda conforme espessura e processo.',
  };
}

function calcSemiCilindro({ diametro, comprimento }) {
  const d = toNum(diametro);
  const c = toNum(comprimento);
  const desenvolvimento = (Math.PI * d) / 2;
  const area = desenvolvimento * c;
  return {
    desenvolvimento: r2(desenvolvimento),
    comprimento_chapa: r2(c),
    area_aproximada: r2(area),
    observacao_tecnica: 'Semi-cilindro considera meia circunferência para desenvolvimento.',
  };
}

function calcBocaDeLoboExcentrica({ dPrincipal, dDerivacao, deslocamento }) {
  const D = toNum(dPrincipal);
  const d = toNum(dDerivacao);
  const off = toNum(deslocamento);
  const raioBase = D / 2;
  const raioDerivacao = d / 2;
  const alongamento = Math.sqrt(off ** 2 + raioDerivacao ** 2);
  return {
    raio_base: r2(raioBase),
    raio_derivacao: r2(raioDerivacao),
    alongamento_curva: r2(alongamento),
    observacao_tecnica: 'Marcar curva em pontos (12 ou mais divisões) por ser excêntrica.',
  };
}

function calcBocaDeLoboAngulo({ dPrincipal, dDerivacao }, fator = 1) {
  const D = toNum(dPrincipal);
  const d = toNum(dDerivacao);
  const intersecao = (Math.PI * d) * fator;
  const abertura = Math.atan2(d, D) * (180 / Math.PI);
  return {
    intersecao_aproximada: r2(intersecao),
    abertura_aproximada_graus: r2(abertura),
    observacao_tecnica: 'Executar marcação por pontos na boca e conferir em gabarito.',
  };
}

function calcMaoFrancesa({ base, altura, largura, comprimento }) {
  const b = Number(base ?? largura);
  const h = Number(altura ?? comprimento);

  const diagonal = Math.sqrt((b * b) + (h * h));

  return {
    entrada: { base: b, altura: h },
    resultado: {
      diagonal: Number(diagonal.toFixed(2)),
    },
    observacoes: [
      'Comprimento da barra diagonal da mão francesa.',
    ],
  };
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
      return calcBocaDeLoboExcentrica(params);
    case TIPOS.BOCA_DE_LOBO_45:
      return calcBocaDeLoboAngulo(params, 0.75);
    case TIPOS.BOCA_DE_LOBO_90:
      return calcBocaDeLoboAngulo(params, 1);
    case TIPOS.MAO_FRANCESA:
      return calcMaoFrancesa(params);
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
