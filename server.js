// server.js
require("dotenv").config();
require("./database/migrate");

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const engine = require("ejs-mate");

const app = express();
app.set("trust proxy", 1);

// ===== View Engine =====
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ===== Middlewares =====
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    name: process.env.SESSION_COOKIE_NAME || "cg.sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: "auto",
    },
  })
);

app.use(flash());

// ===== TESTE DIRETO (GARANTIA QUE SERVER ESTÁ RODANDO) =====
app.get("/teste", (req, res) => {
  res.send("SERVIDOR OK");
});

// ===== ROTAS =====
app.use("/auth", require("./modules/auth/auth.routes"));
app.use("/dashboard", require("./modules/dashboard/dashboard.routes"));
app.use("/compras", require("./modules/compras/compras.routes"));
app.use("/estoque", require("./modules/estoque/estoque.routes"));
app.use("/os", require("./modules/os/os.routes"));
app.use("/usuarios", require("./modules/usuarios/usuarios.routes"));
app.use("/equipamentos", require("./modules/equipamentos/equipamentos.routes"));
app.use("/preventivas", require("./modules/preventivas/preventivas.routes"));
app.use("/escala", require("./modules/escala/escala.routes"));

// ===== HOME =====
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/auth/login");
});

// ===== HEALTH =====
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).send("404 - Página não encontrada");
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error("❌ ERRO:", err);
  res.status(500).send("500 - Erro interno");
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 Servidor ativo na porta ${port}`);
});
