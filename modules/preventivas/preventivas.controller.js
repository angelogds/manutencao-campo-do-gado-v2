// modules/preventivas/preventivas.controller.js
const service = require("./preventivas.service");

function planosIndex(req, res) {
  const ativo = (req.query.ativo || "").trim(); // "1" | "0" | ""
  const lista = service.listPlanos({ ativo });

  return res.render("preventivas/planos/index", {
    title: "Preventivas",
    lista,
    ativo,
  });
}

function planosNewForm(req, res) {
  const equipamentos = service.listEquipamentosAtivos();
  return res.render("preventivas/planos/new", {
    title: "Novo Plano Preventivo",
    equipamentos,
  });
}

function planosCreate(req, res) {
  const {
    equipamento_id,
    titulo,
    frequencia_tipo,
    frequencia_valor,
    observacao,
  } = req.body;

  if (!titulo || !String(titulo).trim()) {
    req.flash("error", "Informe o título do plano.");
    return res.redirect("/preventivas/planos/new");
  }

  const id = service.createPlano({
    equipamento_id: equipamento_id ? Number(equipamento_id) : null,
    titulo: String(titulo).trim(),
    frequencia_tipo: (frequencia_tipo || "mensal").trim(),
    frequencia_valor: frequencia_valor ? Number(frequencia_valor) : 1,
    observacao: (observacao || "").trim(),
  });

  req.flash("success", "Plano preventivo criado.");
  return res.redirect(`/preventivas/planos/${id}`);
}

function planosShow(req, res) {
  const id = Number(req.params.id);
  const plano = service.getPlanoById(id);

  if (!plano) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("preventivas/planos/show", {
    title: `Plano #${id}`,
    plano,
  });
}

function planosToggleAtivo(req, res) {
  const id = Number(req.params.id);
  service.togglePlanoAtivo(id);
  req.flash("success", "Plano atualizado.");
  return res.redirect(`/preventivas/planos/${id}`);
}

function execucoesCreate(req, res) {
  const plano_id = Number(req.params.id);
  const { data_prevista, responsavel, observacao } = req.body;

  service.createExecucao({
    plano_id,
    data_prevista: (data_prevista || "").trim() || null,
    responsavel: (responsavel || "").trim() || null,
    observacao: (observacao || "").trim() || null,
  });

  req.flash("success", "Execução lançada.");
  return res.redirect(`/preventivas/planos/${plano_id}`);
}

function execucoesUpdateStatus(req, res) {
  const execId = Number(req.params.execId);
  const { status, data_executada } = req.body;

  service.updateExecucaoStatus(execId, {
    status: (status || "").trim(),
    data_executada: (data_executada || "").trim() || null,
  });

  const plano_id = service.getPlanoIdByExecucao(execId);
  req.flash("success", "Status da execução atualizado.");
  return res.redirect(plano_id ? `/preventivas/planos/${plano_id}` : "/preventivas");
}

module.exports = {
  planosIndex,
  planosNewForm,
  planosCreate,
  planosShow,
  planosToggleAtivo,
  execucoesCreate,
  execucoesUpdateStatus,
};
