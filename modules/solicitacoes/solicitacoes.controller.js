const service = require("./solicitacoes.service");

function minhas(req, res) {
  const userId = req.session.user.id;
  res.render("solicitacoes/minhas", {
    title: "Minhas Solicitações",
    activeMenu: "solicitacoes",
    lista: service.listMinhasSolicitacoes(userId),
    counters: service.getCountersForUser(userId),
  });
}

function nova(req, res) {
  res.render("solicitacoes/nova", {
    title: "Nova Solicitação",
    activeMenu: "solicitacoes",
    equipamentos: service.listEquipamentos(),
    estoqueItens: service.listEstoqueItens(),
  });
}

function criar(req, res) {
  const arr = (v) => (Array.isArray(v) ? v : [v]);
  const nomes = arr(req.body.item_nome);
  const descs = arr(req.body.item_descricao);
  const uns = arr(req.body.unidade);
  const qtds = arr(req.body.qtd_solicitada);
  const ids = arr(req.body.estoque_item_id);
  const itens = nomes
    .map((n, i) => ({ item_nome: String(n || "").trim(), item_descricao: String(descs[i] || "").trim(), unidade: uns[i], qtd_solicitada: Number(qtds[i] || 0), estoque_item_id: ids[i] ? Number(ids[i]) : null }))
    .filter((i) => i.item_nome && i.qtd_solicitada > 0);
  if (!itens.length) {
    req.flash("error", "Informe ao menos um item válido.");
    return res.redirect("/solicitacoes/nova");
  }
  const id = service.createSolicitacao({ ...req.body, userId: req.session.user.id, itens });
  req.flash("success", "Solicitação criada.");
  res.redirect(`/solicitacoes/${id}`);
}

function detalhe(req, res) {
  const sol = service.getSolicitacaoById(Number(req.params.id));
  if (!sol) return res.status(404).send("Solicitação não encontrada");
  if (req.session.user.role !== "ADMIN" && sol.solicitante_user_id !== req.session.user.id) {
    req.flash("error", "Sem permissão para esta solicitação.");
    return res.redirect("/solicitacoes/minhas");
  }
  res.render("solicitacoes/detalhe", { title: sol.numero, activeMenu: "solicitacoes", sol });
}

module.exports = { minhas, nova, criar, detalhe };
