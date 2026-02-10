const service = require("./preventivas.service");

function index(req, res) {
  const lista = service.listPlanos();
  return res.render("preventivas/index", {
    title: "Preventivas",
    activeMenu: "preventivas",
    lista,
  });
}

function newForm(req, res) {
  const equipamentos = service.listEquipamentos();
  return res.render("preventivas/nova", {
    title: "Nova Preventiva",
    activeMenu: "preventivas",
    equipamentos,
  });
}

function create(req, res) {
  const { equipamento_id, titulo, frequencia_tipo, frequencia_valor, observacao } = req.body;

  if (!titulo || !titulo.trim()) {
    req.flash("error", "Informe o título da preventiva.");
    return res.redirect("/preventivas/nova");
  }

  const id = service.createPlano({
    equipamento_id: equipamento_id ? Number(equipamento_id) : null,
    titulo: titulo.trim(),
    frequencia_tipo: (frequencia_tipo || "mensal").trim(),
    frequencia_valor: frequencia_valor ? Number(frequencia_valor) : 1,
    observacao: (observacao || "").trim(),
  });

  req.flash("success", "Preventiva criada com sucesso.");
  return res.redirect(`/preventivas/${id}`);
}

function show(req, res) {
  const id = Number(req.params.id);
  const plano = service.getPlanoById(id);

  if (!plano) return res.status(404).render("errors/404", { title: "Não encontrado" });

  return res.render("preventivas/show", {
    title: `Preventiva #${id}`,
    activeMenu: "preventivas",
    plano,
  });
}

module.exports = { index, newForm, create, show };
