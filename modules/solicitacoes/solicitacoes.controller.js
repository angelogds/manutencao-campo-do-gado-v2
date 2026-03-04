const service = require("./solicitacoes.service");

function minhas(req, res) {
  const userId = req.session.user.id;
  const filters = {
    query: (req.query.q || "").trim(),
    status: Object.values(service.STATUS).includes(req.query.status) ? req.query.status : "",
    date: req.query.date || "",
  };

  res.render("solicitacoes/minhas", {
    title: "Minhas Solicitações",
    activeMenu: "solicitacoes",
    lista: service.listMinhasSolicitacoes(userId, filters),
    counters: service.getCountersForUser(userId),
    filters,
    statuses: Object.values(service.STATUS),
  });
}

function nova(req, res) {
  res.render("solicitacoes/new", {
    title: "Nova Solicitação",
    activeMenu: "solicitacoes",
    equipamentos: service.listEquipamentos(),
    estoqueItens: service.listEstoqueItens(),
    formData: {},
    formItens: [],
  });
}

function criar(req, res) {
  const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === "") return [];
    return [value];
  };

  const nomes = toArray(req.body.itens_nome ?? req.body['itens_nome[]'] ?? req.body.item_nome);
  const especificacoes = toArray(req.body.itens_especificacao ?? req.body['itens_especificacao[]'] ?? req.body.item_descricao);
  const unidades = toArray(req.body.itens_un ?? req.body['itens_un[]'] ?? req.body.unidade);
  const quantidades = toArray(req.body.itens_qtd ?? req.body['itens_qtd[]'] ?? req.body.qtd_solicitada);
  const itemIds = toArray(req.body.itens_item_id ?? req.body['itens_item_id[]'] ?? req.body.estoque_item_id);

  const tamanho = Math.max(nomes.length, especificacoes.length, unidades.length, quantidades.length, itemIds.length);
  const itens = Array.from({ length: tamanho }, (_, i) => ({
    item_nome: String(nomes[i] || "").trim(),
    item_descricao: String(especificacoes[i] || "").trim(),
    unidade: String(unidades[i] || "UN").trim() || "UN",
    qtd_solicitada: Number(quantidades[i] || 0),
    estoque_item_id: itemIds[i] ? Number(itemIds[i]) : null,
  })).filter((item) => item.item_nome && item.qtd_solicitada > 0);

  if (!itens.length) {
    req.flash("error", "Informe ao menos um item válido.");
    return res.redirect("/solicitacoes/nova");
  }

  const id = service.createSolicitacao({ ...req.body, userId: req.session.user.id, itens });
  req.flash("success", "Solicitação criada.");
  res.redirect(`/solicitacoes/${id}`);
}

function detalhe(req, res) {
  const solicitacao = service.getSolicitacaoById(Number(req.params.id));
  if (!solicitacao) return res.status(404).send("Solicitação não encontrada");

  if (req.session.user.role !== "ADMIN" && solicitacao.solicitante_user_id !== req.session.user.id) {
    req.flash("error", "Sem permissão para esta solicitação.");
    return res.redirect("/solicitacoes/minhas");
  }

  const backUrl = req.query.from === "compras" ? "/compras/solicitacoes" : "/solicitacoes/minhas";
  return res.render("solicitacoes/show", {
    title: "Solicitação",
    activeMenu: "solicitacoes",
    solicitacao,
    itens: solicitacao.itens || [],
    backUrl,
  });
}

module.exports = { minhas, nova, criar, detalhe };
