const service = require("./os.service");

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
  return res.render("os/nova", {
    title: "Nova OS",
    equipamentos,
    graus,
    tipos,
    user: req.session?.user || null,
    prefillEquipamentoId: req.query.equipamento_id || "",
  });
}

function osCreate(req, res) {
  try {
    const { equipamento_id, equipamento_manual, descricao, tipo, grau } = req.body;

    const id = service.createOS({
      equipamento_id: equipamento_id ? Number(equipamento_id) : null,
      equipamento_manual,
      descricao,
      tipo,
      grau,
      opened_by: req.session?.user?.id || null,
    });

    const fotosAbertura = mapFilesToPublic(req.files?.abertura_fotos || []);
    service.addFotosAberturaFechamento({
      osId: id,
      files: fotosAbertura,
      tipo: "ABERTURA",
      userId: req.session?.user?.id || null,
    });

    req.flash("success", `OS #${id} criada com sucesso.`);
    return res.redirect("/os");
  } catch (err) {
    console.error("❌ osCreate:", err);
    req.flash("error", err.message || "Erro ao salvar a OS.");
    return res.redirect("/os/nova");
  }
}

function osShow(req, res) {
  res.locals.activeMenu = "os";
  const id = Number(req.params.id);
  const os = service.getOSById(id);

  if (!os) return res.status(404).render("errors/404", { title: "Não encontrado" });

  return res.render("os/show", {
    title: `OS #${id}`,
    os,
    user: req.session?.user || null,
  });
}

function osIniciar(req, res) {
  const id = Number(req.params.id);
  try {
    service.iniciarOS(id, req.session?.user?.id || null);
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

function osConcluir(req, res) {
  const id = Number(req.params.id);
  try {
    const fotosFechamento = mapFilesToPublic(req.files?.fechamento_fotos || []);
    service.addFotosAberturaFechamento({
      osId: id,
      files: fotosFechamento,
      tipo: "FECHAMENTO",
      userId: req.session?.user?.id || null,
    });

    service.concluirOS(id, {
      closedBy: req.session?.user?.id || null,
      diagnostico: req.body.diagnostico,
      acaoExecutada: req.body.acao_executada,
      pecas: normalizePecasBody(req.body),
    });

    req.flash("success", "OS concluída com sucesso.");
  } catch (err) {
    req.flash("error", err.message || "Não foi possível concluir a OS.");
  }
  return res.redirect(`/os/${id}`);
}

function osUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  try {
    service.updateStatus(id, status, req.session?.user?.id || null);
    req.flash("success", "Status atualizado.");
    return res.redirect(`/os/${id}`);
  } catch (err) {
    console.error("❌ osUpdateStatus:", err);
    req.flash("error", "Erro ao atualizar status.");
    return res.redirect(`/os/${id}`);
  }
}

module.exports = {
  osIndex,
  osNewForm,
  osCreate,
  osShow,
  osIniciar,
  osPausar,
  osConcluir,
  osUpdateStatus,
};
