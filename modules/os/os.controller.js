// modules/os/os.controller.js
const service = require("./os.service");

function osIndex(req, res) {
  const lista = service.list();
  return res.render("os/index", {
    title: "Ordem de Serviço (OS)",
    lista,
  });
}

function osNewForm(req, res) {
  return res.render("os/nova", {
    title: "Abrir OS",
  });
}

function osCreate(req, res) {
  const { equipamento, descricao, tipo } = req.body;

  if (!equipamento || !equipamento.trim()) {
    req.flash("error", "Informe o equipamento.");
    return res.redirect("/os/nova");
  }
  if (!descricao || !descricao.trim()) {
    req.flash("error", "Informe a descrição do serviço.");
    return res.redirect("/os/nova");
  }

  const id = service.create({
    equipamento: equipamento.trim(),
    descricao: descricao.trim(),
    tipo: (tipo || "CORRETIVA").trim(),
    opened_by: req.session?.user?.id || null,
  });

  req.flash("success", "OS aberta com sucesso.");
  return res.redirect(`/os/${id}`);
}

function osShow(req, res) {
  const id = Number(req.params.id);
  const os = service.getById(id);

  if (!os) {
    return res.status(404).render("errors/404", { title: "Não encontrado" });
  }

  return res.render("os/show", {
    title: `OS #${os.id}`,
    os,
  });
}

function osUpdateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!status || !String(status).trim()) {
    req.flash("error", "Status inválido.");
    return res.redirect(`/os/${id}`);
  }

  // Se concluiu/cancelou, marca closed_at e closed_by
  const userId = req.session?.user?.id || null;
  service.updateStatus(id, String(status).trim(), userId);

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
