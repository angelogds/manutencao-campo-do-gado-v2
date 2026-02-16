const service = require("./motores.service");

function index(req, res) {
  const filtros = {
    q: String(req.query.q || "").trim(),
    origem: String(req.query.origem || "").trim(),
    status: String(req.query.status || "").trim(),
    potencia: String(req.query.potencia || "").trim(),
  };

  const lista = service.list(filtros);

  return res.render("motores/index", {
    title: "Motores",
    activeMenu: "motores",
    filtros,
    lista,
  });
}

function newForm(req, res) {
  return res.render("motores/new", {
    title: "Cadastrar Motor",
    activeMenu: "motores",
  });
}

function create(req, res) {
  const data = {
    codigo: String(req.body.codigo || "").trim() || null,
    descricao: String(req.body.descricao || "").trim(),
    potencia_cv: req.body.potencia_cv ? Number(req.body.potencia_cv) : null,
    rpm: req.body.rpm ? Number(req.body.rpm) : null,
    origem_unidade: String(req.body.origem_unidade || "RECICLAGEM").trim(),
    local_instalacao: String(req.body.local_instalacao || "").trim() || null,
    status: String(req.body.status || "EM_USO").trim(),
    observacao: String(req.body.observacao || "").trim() || null,
  };

  if (!data.descricao) {
    req.flash("error", "Informe a descrição do motor.");
    return res.redirect("/motores/new");
  }

  const id = service.create(data, req.session?.user?.id || null);
  req.flash("success", `Motor #${id} cadastrado.`);
  return res.redirect(`/motores/${id}`);
}

function show(req, res) {
  const id = Number(req.params.id);
  const motor = service.getById(id);
  if (!motor) return res.status(404).send("Motor não encontrado");

  const eventos = service.listEventos(id);

  return res.render("motores/view", {
    title: `Motor #${id}`,
    activeMenu: "motores",
    motor,
    eventos,
  });
}

function enviar(req, res) {
  const id = Number(req.params.id);

  const empresa_rebob = String(req.body.empresa_rebob || "").trim();
  const motorista_saida = String(req.body.motorista_saida || "").trim();
  const observacao = String(req.body.observacao || "").trim() || null;

  if (!empresa_rebob) {
    req.flash("error", "Informe a empresa de rebobinamento.");
    return res.redirect(`/motores/${id}`);
  }

  service.enviarRebob(id, { empresa_rebob, motorista_saida, observacao }, req.session?.user?.id || null);
  req.flash("success", "Saída para rebobinamento registrada.");
  return res.redirect(`/motores/${id}`);
}

function retorno(req, res) {
  const id = Number(req.params.id);

  const motorista_retorno = String(req.body.motorista_retorno || "").trim();
  const observacao = String(req.body.observacao || "").trim() || null;

  service.registrarRetorno(id, { motorista_retorno, observacao }, req.session?.user?.id || null);
  req.flash("success", "Retorno registrado.");
  return res.redirect(`/motores/${id}`);
}

module.exports = { index, newForm, create, show, enviar, retorno };
