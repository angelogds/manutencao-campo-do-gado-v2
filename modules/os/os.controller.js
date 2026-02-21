// modules/os/os.controller.js
const service = require("./os.service");

function osIndex(req, res) {
  res.locals.activeMenu = "os";
  const lista = service.listOS();
  return res.render("os/index", { title: "Ordens de Serviço", lista });
}

function osNewForm(req, res) {
  res.locals.activeMenu = "os";
  const equipamentos = service.listEquipamentosAtivos();
  const graus = service.listGrauOptions();
  return res.render("os/nova", { title: "Nova OS", equipamentos, graus });
}

function osCreate(req, res) {
  try {
    const { equipamento_id, equipamento_texto, descricao, tipo, grau } = req.body;

    const id = service.createOS({
      equipamento_id: equipamento_id ? Number(equipamento_id) : null,
      equipamento_texto,
      descricao,
      tipo,
      grau,
      opened_by: req.session?.user?.id || null,
    });

    req.flash("success", "OS criada com sucesso.");
    return res.redirect(`/os/${id}`);
  } catch (err) {
    console.error("❌ osCreate:", err);
    req.flash("error", "Erro ao salvar a OS. Verifique o log.");
    return res.redirect("/os/nova");
  }
}

function osShow(req, res) {
  res.locals.activeMenu = "os";
  const id = Number(req.params.id);
  const os = service.getOSById(id);

  if (!os) return res.status(404).render("errors/404", { title: "Não encontrado" });

  return res.render("os/show", { title: `OS #${id}`, os });
}

function osUpdateStatus(req, res) {
  res.locals.activeMenu = "os";
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

module.exports = { osIndex, osNewForm, osCreate, osShow, osUpdateStatus };
