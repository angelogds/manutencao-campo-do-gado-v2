// modules/os/os.controller.js
const service = require("./os.service");

function osIndex(req, res) {
  const { status } = req.query;

  const lista = service.listOS({
    status: status ? String(status).trim().toUpperCase() : null,
  });

  const blocks = service.getBlocks();

  return res.render("os/index", {
    title: "Ordens de Serviço",
    activeMenu: "os",
    lista,
    blocks,
    statusFilter: status ? String(status).trim().toUpperCase() : "",
  });
}

function osNewForm(req, res) {
  return res.render("os/nova", {
    title: "Nova OS",
    activeMenu: "os",
  });
}

function osCreate(req, res) {
  const { equipamento, descricao, tipo } = req.body;

  if (!equipamento || !String(equipamento).trim()) {
    req.flash("error", "Informe o equipamento.");
    return res.redirect("/os/nova");
  }

  if (!descricao || !String(descricao).trim()) {
    req.flash("error", "Informe a descrição da OS.");
    return res.redirect("/os/nova");
  }

  const id = service.createOS({
    equipamento: String(equipamento).trim(),
    descricao: String(descricao).trim(),
    tipo: String(tipo || "CORRETIVA").trim().toUpperCase(),
    opened_by: req.session?.user?.id || null,
  });

  req.flash("success", "OS criada com sucesso.");
  return res.redirect(`/os/${id}`);
}

function osShow(req, res) {
  const id = Number(req.params.id);
  const os = service.getOSById(id);

  if (!os) {
    return res.status(404).render("errors/404", {
      title: "Não encontrado",
      activeMenu: "os",
    });
  }

  return res.render("os/show", {
    title: `OS #${id}`,
    activeMenu: "os",
    os,
  });
}

function osUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  const ok = service.updateOSStatus(id, String(status || "").trim().toUpperCase(), {
    userId: req.session?.user?.id || null,
  });

  if (!ok) {
    req.flash("error", "Não foi possível atualizar o status.");
    return res.redirect(`/os/${id}`);
  }

  req.flash("success", "Status atualizado.");
  return res.redirect(`/os/${id}`);
}

module.exports = {
  osIndex,
  osNewForm,
  osCreate,
  osShow,
  osUpdateStatus,
};
