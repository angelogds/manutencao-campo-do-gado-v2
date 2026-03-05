const service = require("./os.service");
const pushService = require("../push/push.service");
const { normalizeRole } = require("../../config/rbac");

function mapFilesToPublic(files = []) {
  return (files || []).map((f) => ({
    ...f,
    pathPublic: `/uploads/os/${f.filename}`,
  }));
}

function osIndex(req, res) {
  res.locals.activeMenu = "os";
  const lista = service.listOS();
  return res.render("os/index", { title: "Ordens de Serviço", lista });
}

function osNewForm(req, res) {
  res.locals.activeMenu = "os";
  const equipamentos = service.listEquipamentosAtivos();
  const graus = service.listGrauOptions();
  const tipos = service.listTipoOptions();
  return res.render("os/new", {
    title: "Nova OS",
    equipamentos,
    graus,
    tipos,
    user: req.session?.user || null,
    prefillEquipamentoId: req.query.equipamento_id || "",
  });
}

async function osCreate(req, res) {
  try {
    const {
      equipamento_id,
      equipamento_manual,
      descricao,
      resumo_tecnico,
      causa_diagnostico,
      data_inicio,
      data_fim,
      tipo,
      grau,
    } = req.body;

    const id = service.createOS({
      equipamento_id: equipamento_id ? Number(equipamento_id) : null,
      equipamento_manual,
      descricao,
      resumo_tecnico,
      causa_diagnostico,
      data_inicio,
      data_fim,
      tipo,
      grau,
      opened_by: req.session?.user?.id || null,
    });

    const grauNormalizado = String(grau || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (["MEDIA", "ALTA", "CRITICA"].includes(grauNormalizado)) {
      const alocacao = service.autoAssignEquipe(id, req.session?.user?.id || null);
      if (alocacao?.aguardando) {
        req.flash("error", alocacao.aviso);
      }
    }

    const fotosAbertura = mapFilesToPublic(req.files?.abertura_fotos || []);
    service.addFotosAberturaFechamento({
      osId: id,
      files: fotosAbertura,
      tipo: "ABERTURA",
      userId: req.session?.user?.id || null,
    });

    await pushService.sendPushToAll({
      title: "Nova Ordem de Serviço",
      body: `OS #${id} - ${equipamento_manual || (equipamento_id ? `Equipamento #${equipamento_id}` : 'Equipamento')}`,
      url: `/os/${id}`,
    }).catch(() => {});

    req.flash("success", `OS #${id} criada com sucesso.`);
    return res.redirect("/os");
  } catch (err) {
    console.error("❌ osCreate:", err);
    req.flash("error", err.message || "Erro ao salvar a OS.");
    return res.redirect("/os/novo");
  }
}

function osShow(req, res) {
  res.locals.activeMenu = "os";
  const id = Number(req.params.id);
  const os = service.getOSById(id);

  if (!os) return res.status(404).render("errors/404", { title: "Não encontrado" });

  const role = normalizeRole(req.session?.user?.role || "");
  const canAutoAssign = ["ADMIN", "SUPERVISOR_MANUTENCAO", "MANUTENCAO_SUPERVISOR"].includes(role);

  return res.render("os/show", {
    title: `OS #${id}`,
    os,
    canAutoAssign,
    user: req.session?.user || null,
  });
}

function osCloseForm(req, res) {
  res.locals.activeMenu = "os";
  const id = Number(req.params.id);
  const os = service.getOSById(id);
  if (!os) return res.status(404).render("errors/404", { title: "Não encontrado" });
  return res.render("os/close", {
    title: `Fechar OS #${id}`,
    os,
    user: req.session?.user || null,
  });
}

async function osIniciar(req, res) {
  const id = Number(req.params.id);
  try {
    service.iniciarOS(id, req.session?.user?.id || null);
    await pushService.sendPushToAll({
      title: "OS em andamento",
      body: `OS #${id} entrou em andamento.`,
      url: `/os/${id}`,
    }).catch(() => {});
    req.flash("success", "OS iniciada e enviada para andamento.");
  } catch (err) {
    req.flash("error", err.message || "Não foi possível iniciar a OS.");
  }
  return res.redirect(`/os/${id}`);
}

function osPausar(req, res) {
  const id = Number(req.params.id);
  try {
    service.pausarOS(id);
    req.flash("success", "OS pausada.");
  } catch (err) {
    req.flash("error", err.message || "Não foi possível pausar a OS.");
  }
  return res.redirect(`/os/${id}`);
}

function normalizePecasBody(body) {
  const desc = Array.isArray(body.peca_descricao) ? body.peca_descricao : [body.peca_descricao];
  const qtd = Array.isArray(body.peca_quantidade) ? body.peca_quantidade : [body.peca_quantidade];

  return desc.map((d, idx) => ({
    peca_descricao: d,
    quantidade: qtd[idx],
  }));
}

async function osClose(req, res) {
  const id = Number(req.params.id);
  console.log("[OS_CLOSE] Iniciando fechamento", {
    osId: id,
    userId: req.session?.user?.id || null,
    data_fim_payload: req.body?.data_fim || null,
  });

  try {
    if (!String(req.body.resumo_tecnico || "").trim() || !String(req.body.causa_diagnostico || "").trim()) {
      throw new Error("Resumo técnico e causa/diagnóstico são obrigatórios para fechar a OS.");
    }

    const fotosFechamento = mapFilesToPublic(req.files?.fechamento_fotos || []);
    service.addFotosAberturaFechamento({
      osId: id,
      files: fotosFechamento,
      tipo: "FECHAMENTO",
      userId: req.session?.user?.id || null,
    });

    const syncResult = service.concluirOS(id, {
      closedBy: req.session?.user?.id || null,
      diagnostico: req.body.diagnostico || req.body.causa_diagnostico,
      acaoExecutada: req.body.acao_executada || req.body.resumo_tecnico,
      pecas: normalizePecasBody(req.body),
      dataFim: req.body.data_fim,
    });

    await pushService.sendPushToAll({
      title: "OS finalizada",
      body: `OS #${id} foi finalizada.`,
      url: `/os/${id}`,
    }).catch(() => {});

    console.log("[OS_CLOSE] Fechamento concluído", { osId: id, syncResult });
    req.flash("success", "OS concluída com sucesso.");
  } catch (err) {
    console.error("[OS_CLOSE][ERROR]", err);
    req.flash("error", err.message || "Não foi possível concluir a OS.");
  }
  return res.redirect(`/os/${id}`);
}

async function osUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  try {
    service.updateStatus(id, status, req.session?.user?.id || null);

    const st = String(status || '').toUpperCase();
    if (st === 'ANDAMENTO' || st === 'EM_ANDAMENTO') {
      await pushService.sendPushToAll({
        title: "OS em andamento",
        body: `OS #${id} entrou em andamento.`,
        url: `/os/${id}`,
      }).catch(() => {});
    }
    if (['FECHADA', 'FINALIZADA', 'CONCLUIDA', 'CONCLUÍDA'].includes(st)) {
      await pushService.sendPushToAll({
        title: "OS finalizada",
        body: `OS #${id} foi finalizada.`,
        url: `/os/${id}`,
      }).catch(() => {});
    }

    req.flash("success", "Status atualizado.");
    return res.redirect(`/os/${id}`);
  } catch (err) {
    console.error("❌ osUpdateStatus:", err);
    req.flash("error", "Erro ao atualizar status.");
    return res.redirect(`/os/${id}`);
  }
}

function osAutoAssign(req, res) {
  const id = Number(req.params.id);
  try {
    const result = service.autoAssignEquipe(id, req.session?.user?.id || null);
    if (!result) {
      req.flash("success", "OS de baixa complexidade: sem autoalocação de mecânico.");
    } else if (result.aguardando) {
      req.flash("error", result.aviso);
    } else {
      req.flash("success", `Equipe atribuída: ${result.mecanico.nome} + ${result.auxiliar.nome}.`);
    }
  } catch (err) {
    req.flash("error", err.message || "Não foi possível sugerir a equipe.");
  }
  return res.redirect(`/ordens-servico/${id}`);
}

module.exports = {
  osIndex,
  osNewForm,
  osCreate,
  osShow,
  osCloseForm,
  osIniciar,
  osPausar,
  osClose,
  osUpdateStatus,
  osAutoAssign,
};
