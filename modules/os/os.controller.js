const db = require("../../database/db");

function index(req, res) {
  const itens = db.prepare("SELECT * FROM os ORDER BY id DESC").all();
  return res.render("os/index", { title: "Ordens de Serviço", itens });
}

function createForm(req, res) {
  return res.render("os/create", { title: "Nova OS" });
}

function create(req, res) {
  const { titulo, descricao } = req.body;

  if (!titulo) {
    req.flash("error", "Informe o título.");
    return res.redirect("/os/nova");
  }

  db.prepare(`
    INSERT INTO os (titulo, descricao, created_at)
    VALUES (?, ?, datetime('now'))
  `).run(titulo, descricao || "");

  req.flash("success", "OS criada com sucesso.");
  return res.redirect("/os");
}

module.exports = {
  index,
  createForm,
  create,
};
