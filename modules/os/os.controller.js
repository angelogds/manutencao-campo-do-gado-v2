// modules/os/os.controller.js
const service = require("./os.service");
const db = require("../../database/db");

function osIndex(req, res) {
  res.locals.activeMenu = "os";
  const lista = service.listOS();
  return res.render("os/index", { title: "Ordens de Serviço", lista });
}

function osNewForm(req, res) {
  res.locals.activeMenu = "os";

  // puxa equipamentos cadastrados
  const equipamentos = db
    .prepare(
      `SELECT id, codigo, nome, setor, tipo, criticidade
       FROM equipamentos
       WHERE ativo = 1
       ORDER BY nome`
    )
    .all();

  return res.render("os/nova", {
    title: "Nova OS",
    equipamentos,
  });
}

function osCreate(req, res) {
  res.locals.activeMenu = "os";

  try {
    const { equipamento_id, equipamento_texto, descricao, tipo } = req.body;

    if (!descricao || !descricao.trim()) {
      req.flash("error", "Descreva o serviço.");
      return res.redirect("/os/nova");
    }

    // equipamento_id é o padrão; se não vier, aceita texto
    const equipIdNum = equipamento_id ? Number(equipamento_id) : null;

    let equipTextoFinal = (equipamento_texto || "").trim();

    if (equipIdNum) {
      const eq = db
        .prepare(`SELECT nome FROM equipamentos WHERE id = ?`)
        .get(equipIdNum);
      if (eq && eq.nome) equipTextoFinal = eq.nome;
    }

    if (!equipIdNum && !equipTextoFinal) {
      req.flash("error", "Selecione um equipamento ou informe o nome.");
      return res.redirect("/os/nova");
    }

    const opened_by = req.session?.user?.id || null;

    const id = service.createOS({
      equipamento_id: equipIdNum,
      equipamento_texto: equipTextoFinal,
      descricao,
      tipo,
      opened_by,
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

  if (!os) {
    return res.status(404).send("OS não encontrada");
  }

  return res.render("os/show", {
    title: `OS #${id}`,
    os,
  });
}

function osUpdateStatus(req, res) {
  res.locals.activeMenu = "os";
  const id = Number(req.params.id);
  const { status } = req.body;

  const closed_by = req.session?.user?.id || null;

  service.updateStatus(id, status, closed_by);
  req.flash("success", "Status atualizado.");
  return res.redirect(`/os/${id}`);
}

module.exports = { osIndex, osNewForm, osCreate, osShow, osUpdateStatus };
