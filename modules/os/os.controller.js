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
  return res.render("os/new", { title: "Abrir OS" });
};

exports.create = (req, res) => {
  const { titulo, setor, descricao, prioridade } = req.body;

  if (!titulo || !setor || !descricao) {
    req.flash("error", "Preencha título, setor e descrição.");
    return res.redirect("/os/new");
  }

  try {
    const id = service.createOS({
      titulo,
      setor,
      descricao,
      prioridade: prioridade || "NORMAL",
      created_by: req.session.user.id,
    });

    req.flash("success", "OS aberta com sucesso.");
    return res.redirect(`/os/${id}`);
  } catch (e) {
    req.flash("error", e.message || "Erro ao abrir OS.");
    return res.redirect("/os/new");
  }
};

exports.view = (req, res) => {
  const id = Number(req.params.id);
  const os = service.getOSById(id);

  if (!os) {
    req.flash("error", "OS não encontrada.");
    return res.redirect("/os");
  }

  return res.render("os/view", { title: `OS #${os.id}`, os });
};
