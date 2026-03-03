const service = require("./solicitacoes.service");

function minhas(req, res) {
  const userId = req.session?.user?.id;
  res.locals.activeMenu = "solicitacoes";

  return res.render("solicitacoes/minhas", {
    title: "Minhas Solicitações",
    activeMenu: "solicitacoes",
    lista: service.listMinhasSolicitacoes(userId),
    counters: service.getCountersForUser(userId),
  });
}

function nova(req, res) {
  res.locals.activeMenu = "solicitacoes";

  return res.render("solicitacoes/new", {
    title: "Nova Solicitação",
    activeMenu: "solicitacoes",
    equipamentos: service.listEquipamentos(),
    estoqueItens: service.listEstoqueItens(),
  });
}

function criar(req, res) {
  const toArr = (v) => (Array.isArray(v) ? v : [v]);

  const nomes = toArr(req.body.item_nome || req.body.itens_nome);
  const descricoes = toArr(req.body.item_descricao || req.body.itens_especificacao);
  const unidades = toArr(req.body.unidade || req.body.itens_un);
  const quantidades = toArr(req.body.qtd_solicitada || req.body.itens_qtd);
  const estoqueIds = toArr(req.body.estoque_item_id || req.body.itens_item_id);

  const itens = nomes
    .map((nome, idx) => ({
      item_nome: String(nome || "").trim(),
      item_descricao: String(descricoes[idx] || "").trim(),
      unidade: String(unidades[idx] || "UN").trim().toUpperCase(),
      qtd_solicitada: Number(String(quantidades[idx] || "0").replace(",", ".")),
      estoque_item_id: estoqueIds[idx] ? Number(estoqueIds[idx]) : null,
    }))
    .filter((item) => item.item_nome && item.qtd_solicitada > 0);

  if (!itens.length) {
    req.flash("error", "Informe ao menos um item válido.");
    return res.redirect("/solicitacoes/nova");
  }

  const id = service.createSolicitacao({
    ...req.body,
    userId: req.session?.user?.id,
    itens,
  });

  req.flash("success", "Solicitação criada com sucesso.");
  return res.redirect(`/solicitacoes/${id}`);
}

function detalhe(req, res) {
  const sol = service.getSolicitacaoById(Number(req.params.id));
  if (!sol) return res.status(404).send("Solicitação não encontrada.");

  const isAdmin = String(req.session?.user?.role || "").toUpperCase() === "ADMIN";
  if (!isAdmin && Number(sol.solicitante_user_id) !== Number(req.session?.user?.id)) {
    req.flash("error", "Sem permissão para esta solicitação.");
    return res.redirect("/solicitacoes/minhas");
  }

  res.locals.activeMenu = "solicitacoes";
  return res.render("solicitacoes/detalhe", {
    title: sol.numero,
    activeMenu: "solicitacoes",
    sol,
  });
}

module.exports = { minhas, nova, criar, detalhe };
