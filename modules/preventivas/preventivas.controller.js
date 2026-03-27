const service = require("./preventivas.service");
const osService = require("../os/os.service");

function getSugestaoResponsavel() {
  try {
    const turnoAtual = osService.getTurnoAgora();
    const colaboradores = osService.getColaboradoresTurnoAtual(turnoAtual);
    if (!Array.isArray(colaboradores) || !colaboradores.length) {
      return { turnoAtual, colaboradores: [], responsavelPadrao: "" };
    }

    const ordenados = [...colaboradores].sort((a, b) => {
      const funcA = String(a.funcao || "").toUpperCase();
      const funcB = String(b.funcao || "").toUpperCase();
      if (funcA === "MECANICO" && funcB !== "MECANICO") return -1;
      if (funcB === "MECANICO" && funcA !== "MECANICO") return 1;
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });

    const mecanico = ordenados.find((c) => String(c.funcao || "").toUpperCase() === "MECANICO");
    const apoio = ordenados.find((c) => ["AUXILIAR", "APOIO"].includes(String(c.funcao || "").toUpperCase()));
    const responsavelPadrao = apoio && mecanico
      ? `${mecanico.nome} + ${apoio.nome}`
      : String((mecanico || ordenados[0]).nome || "").trim();

    return { turnoAtual, colaboradores: ordenados, responsavelPadrao };
  } catch (_err) {
    return { turnoAtual: "-", colaboradores: [], responsavelPadrao: "" };
  }
}

function index(req, res) {
  const lista = service.listPlanos();
  return res.render("preventivas/index", {
    layout: "layout",
    title: "Preventivas",
    activeMenu: "preventivas",
    lista
  });
}

function newForm(req, res) {
  const equipamentos = service.listEquipamentosAtivos();
  const sugestaoResponsavel = getSugestaoResponsavel();
  return res.render("preventivas/nova", {
    layout: "layout",
    title: "Nova Preventiva",
    activeMenu: "preventivas",
    equipamentos,
    sugestaoResponsavel
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
    frequencia_valor: frequencia_valor ? Number(String(frequencia_valor).replace(",", ".")) : 1,
    ativo: true,
    observacao: (observacao || "").trim()
  });

  req.flash("success", "Preventiva criada com sucesso.");
  return res.redirect(`/preventivas/${id}`);
}

function show(req, res) {
  const id = Number(req.params.id);
  const plano = service.getPlanoById(id);

  if (!plano) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  const execucoes = service.listExecucoes(id);
  const sugestaoResponsavel = getSugestaoResponsavel();

  return res.render("preventivas/show", {
    layout: "layout",
    title: `Preventiva #${id}`,
    activeMenu: "preventivas",
    plano,
    execucoes,
    sugestaoResponsavel
  });
}

function execCreate(req, res) {
  const planoId = Number(req.params.id);
  const { data_prevista, responsavel, observacao } = req.body;
  const sugestao = getSugestaoResponsavel();
  const responsavelFinal = String(responsavel || "").trim() || sugestao.responsavelPadrao;

  service.createExecucao(planoId, {
    data_prevista: (data_prevista || "").trim(),
    status: "pendente",
    responsavel: responsavelFinal,
    observacao: (observacao || "").trim()
  });

  req.flash("success", "Execução adicionada.");
  return res.redirect(`/preventivas/${planoId}`);
}

function execUpdateStatus(req, res) {
  const planoId = Number(req.params.id);
  const execId = Number(req.params.execId);
  const { status, data_executada } = req.body;

  const ok = service.updateExecucaoStatus(planoId, execId, status, data_executada);

  if (!ok) {
    req.flash("error", "Execução não encontrada para este plano.");
    return res.redirect(`/preventivas/${planoId}`);
  }

  req.flash("success", "Status da execução atualizado.");
  return res.redirect(`/preventivas/${planoId}`);
}

module.exports = { index, newForm, create, show, execCreate, execUpdateStatus };
