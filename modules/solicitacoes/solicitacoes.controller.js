const service = require("./solicitacoes.service");

function index(req, res) {
  const lista = service.listSolicitacoes();
  return res.render("solicitacoes/index", {
    title: "Solicitações",
    activeMenu: "solicitacoes",
    lista,
  });
}

function newForm(req, res) {
  return res.render("solicitacoes/new", {
    title: "Nova Solicitação",
    activeMenu: "solicitacoes",
    equipamentos: service.listEquipamentos(),
  });
}

function create(req, res) {
  const { solicitante, setor, observacao, tipo_origem, origem_id, equipamento_id, destino_uso } = req.body;
  const nomeArr = Array.isArray(req.body.itens_nome) ? req.body.itens_nome : [req.body.itens_nome];
  const espArr = Array.isArray(req.body.itens_especificacao) ? req.body.itens_especificacao : [req.body.itens_especificacao];
  const qtdArr = Array.isArray(req.body.itens_qtd) ? req.body.itens_qtd : [req.body.itens_qtd];
  const unArr = Array.isArray(req.body.itens_un) ? req.body.itens_un : [req.body.itens_un];

  const itens = [];
  for (let i = 0; i < nomeArr.length; i++) {
    const nome = String(nomeArr[i] || "").trim();
    const especificacao = String(espArr[i] || "").trim();
    if (!nome) continue;

    itens.push({
      descricao: nome,
      especificacao: especificacao || null,
      quantidade: Number(qtdArr[i] || 1),
      unidade: String(unArr[i] || "UN"),
    });
  }

  if (!itens.length) {
    req.flash("error", "Inclua ao menos um item.");
    return res.redirect("/solicitacoes/nova");
  }

  const id = service.createSolicitacao({
    solicitante: solicitante || req.session?.user?.name || "Usuário",
    setor: setor || "MANUTENCAO",
    observacao,
    itens,
    createdBy: req.session?.user?.id || null,
    vinculo: { tipo_origem, origem_id, equipamento_id, destino_uso },
  });

  req.flash("success", `Solicitação #${id} criada.`);
  return res.redirect(`/solicitacoes/${id}`);
}

function show(req, res) {
  const id = Number(req.params.id);
  const sol = service.getSolicitacaoById(id);
  if (!sol) return res.status(404).send("Solicitação não encontrada");

  return res.render("solicitacoes/show", {
    title: `Solicitação #${id}`,
    activeMenu: "solicitacoes",
    sol,
  });
}

function updateStatus(req, res) {
  const id = Number(req.params.id);
  const status = String(req.body.status || "").toLowerCase();
  service.updateStatus(id, status);
  req.flash("success", "Status atualizado.");
  return res.redirect(`/solicitacoes/${id}`);
}

function addCotacao(req, res) {
  const id = Number(req.params.id);
  const { fornecedor, valor_total, observacao, anexo_path } = req.body;
  if (!fornecedor || String(fornecedor).trim().length < 2) {
    req.flash("error", "Informe o fornecedor da cotação.");
    return res.redirect(`/solicitacoes/${id}`);
  }

  service.addCotacao(id, {
    fornecedor: String(fornecedor).trim(),
    valor_total: Number(valor_total || 0),
    observacao: observacao || null,
    anexo_path: anexo_path || null,
  });

  req.flash("success", "Cotação adicionada.");
  return res.redirect(`/solicitacoes/${id}`);
}

module.exports = { index, newForm, create, show, updateStatus, addCotacao };
