// modules/dashboard/dashboard.service.js
const db = require("../../database/db");
const escalaService = require("../escala/escala.service");

function getCards() {
  // OS abertas
  const os =
    db
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM os
        WHERE status IN ('ABERTA','ANDAMENTO','PAUSADA')
      `
      )
      .get()?.total || 0;

  // Compras abertas (status do seu 050 é minúsculo)
  const compras =
    db
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM solicitacoes_compra
        WHERE status IN ('aberta','cotacao','aprovada')
      `
      )
      .get()?.total || 0;

  // Itens estoque
  const itens =
    db
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM estoque_itens
        WHERE ativo = 1
      `
      )
      .get()?.total || 0;

  // Equipamentos
  const equip =
    db
      .prepare(
        `
        SELECT COUNT(*) AS total
        FROM equipamentos
        WHERE ativo = 1
      `
      )
      .get()?.total || 0;

  return {
    os_abertas: os,
    compras_abertas: compras,
    itens_estoque: itens,
    equipamentos: equip,
  };
}

function getPlantaoAgora() {
  // ✅ Blindagem total: se não existir, não derruba o dashboard
  if (!escalaService || typeof escalaService.getPlantaoAgora !== "function") {
    return {
      ok: false,
      message: "getPlantaoAgora() ainda não está disponível no escala.service.",
      semana: null,
      times: { noturno: [], diurno: [], apoio: [], plantao: [], folga: [] },
    };
  }

  try {
    const result = escalaService.getPlantaoAgora();
    // ✅ garante estrutura mínima
    return (
      result || {
        ok: false,
        message: "Sem dados de plantão.",
        semana: null,
        times: { noturno: [], diurno: [], apoio: [], plantao: [], folga: [] },
      }
    );
  } catch (err) {
    console.error("❌ Erro getPlantaoAgora (dashboard.service):", err);
    return {
      ok: false,
      message: "Erro ao carregar plantão da escala.",
      semana: null,
      times: { noturno: [], diurno: [], apoio: [], plantao: [], folga: [] },
    };
  }
}

module.exports = { getCards, getPlantaoAgora };
