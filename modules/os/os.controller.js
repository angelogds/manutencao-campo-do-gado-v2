const service = require("./os.service");

exports.list = (req, res) => {
  const status = req.query.status || "ABERTA";

  const items = service.listOS({ status });

  return res.render("os/index", {
    title: "Ordens de Serviço",
    items,
    status,
  });
};

exports.newForm = (req, res) => {
  return res.render("os/new", {
    title: "Abrir Ordem de Serviço",
  });
};

exports.create = (req, res) => {
  const { equipamento, descricao, tipo } = req.body;

  if (!equipamento || !descricao) {
    req.flash("error", "Informe o equipamento e a descrição.");
    return res.redirect("/os/new");
  }

  try {
    const id = service.createOS({
      equipamento,
      descricao,
      tipo: tipo || "CORRETIVA",
      opened_by: req.session.user.id,
    });

    req.flash("success", "Ordem de serviço aberta com sucesso.");
    return res.redirect(`/os/${id}`);
  } catch (err) {
    console.error(err);
    req.flash("error", "Erro ao abrir ordem de serviço.");
    return res.redirect("/os/new");
  }
};

exports.view = (req, res) => {
  const id = Number(req.params.id);
  const os = service.getOSById(id);

  if (!os) {
    req.flash("error", "Ordem de serviço não encontrada.");
    return res.redirect("/os");
  }

  return res.render("os/view", {
    title: `OS #${os.id}`,
    os,
  });
};
