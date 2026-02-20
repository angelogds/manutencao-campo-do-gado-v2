const service = require("./pcm.service");

function index(req, res) {
  const filtros = {
    equipamento_id: req.query.equipamento_id || "",
    setor: req.query.setor || "",
    tipo_manutencao: req.query.tipo_manutencao || "",
  };

  return res.render("pcm/index", {
    title: "PCM – Planejamento e Controle da Manutenção",
    activeMenu: "pcm",
    indicadores: service.getIndicadores(),
    ranking: service.getRankingEquipamentos(5, Number(req.query.meses || 6)),
    planos: service.listPlanos(filtros),
    filtros,
    opcoes: service.listFiltros(),
  });
}

function createPlano(req, res) {
  try {
    const id = service.createPlano({
      equipamento_id: req.body.equipamento_id,
      atividade_descricao: req.body.atividade_descricao,
      tipo_manutencao: req.body.tipo_manutencao,
      frequencia_dias: req.body.frequencia_dias,
      frequencia_horas: req.body.frequencia_horas,
      proxima_data_prevista: req.body.proxima_data_prevista,
      observacao: req.body.observacao,
      created_by: req.session?.user?.id || null,
    });
    req.flash("success", `Plano mestre #${id} criado com sucesso.`);
  } catch (e) {
    req.flash("error", e.message || "Erro ao criar plano mestre.");
  }
  return res.redirect("/pcm");
}

function gerarOS(req, res) {
  try {
    const osId = service.gerarOS(req.params.id, req.session?.user?.id || null);
    req.flash("success", `OS preventiva #${osId} gerada automaticamente.`);
  } catch (e) {
    req.flash("error", e.message || "Erro ao gerar OS do plano.");
  }
  return res.redirect("/pcm");
}

function registrarExecucao(req, res) {
  try {
    const osId = service.registrarExecucao(req.params.id, req.session?.user?.id || null);
    req.flash("success", `Execução registrada com vínculo na OS #${osId}.`);
  } catch (e) {
    req.flash("error", e.message || "Erro ao registrar execução.");
  }
  return res.redirect("/pcm");
}

module.exports = {
  index,
  createPlano,
  gerarOS,
  registrarExecucao,
};
