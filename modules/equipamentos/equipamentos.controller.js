const service = require("./equipamentos.service");

exports.index = (req, res) => {
  const itens = service.listAll();

  return res.render("equipamentos/index", {
    title: "Equipamentos",
    itens,
    activeMenu: "equipamentos",
  });
};

exports.newForm = (req, res) => {
  return res.render("equipamentos/new", {
    title: "Cadastrar Equipamento",
    activeMenu: "equipamentos",
  });
};

exports.create = (req, res) => {
  const { nome, setor, codigo } = req.body;

  if (!nome || !setor) {
    req.flash("error", "Preencha Nome e Setor.");
    return res.redirect("/equipamentos/new");
  }

  try {
    const id = service.create({
      nome: nome.trim(),
      setor: setor.trim(),
      codigo: (codigo || "").trim(),
      created_by: req.session.user.id,
    });

    req.flash("success", "Equipamento cadastrado com sucesso.");
    return res.redirect("/equipamentos");
  } catch (e) {
    req.flash("error", e.message || "Erro ao cadastrar equipamento.");
    return res.redirect("/equipamentos/new");
  }
};
