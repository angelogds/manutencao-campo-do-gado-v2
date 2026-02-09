const db = require("../../database/db");

function tableExists(name) {
  try {
    const r = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(name);
    return !!r;
  } catch {
    return false;
  }
}

exports.getCards = () => {
  const cards = {
    os_abertas: 0,
    compras_abertas: 0,
    itens_estoque: 0,
    equipamentos: 0,
  };

  if (tableExists("os")) {
    cards.os_abertas = db
      .prepare("SELECT COUNT(*) AS n FROM os WHERE status='ABERTA'")
      .get().n;
  }

  if (tableExists("solicitacoes")) {
    cards.compras_abertas = db
      .prepare("SELECT COUNT(*) AS n FROM solicitacoes WHERE status='ABERTA'")
      .get().n;
  }

  if (tableExists("estoque")) {
    cards.itens_estoque = db
      .prepare("SELECT COUNT(*) AS n FROM estoque")
      .get().n;
  }

  if (tableExists("equipamentos")) {
    cards.equipamentos = db
      .prepare("SELECT COUNT(*) AS n FROM equipamentos")
      .get().n;
  }

  return cards;
};
