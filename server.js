// server.js
require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const ejsMate = require("ejs-mate");

const db = require("./database/db");

const app = express();

// View engine
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares base
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Sessions (✅ persistente com better-sqlite3)
const SQLiteStoreFactory = require("better-sqlite3-session-store");
const SQLiteStore = SQLiteStoreFactory(session);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // Railway termina SSL no proxy; pode manter false aqui
      maxAge: 1000 * 60 * 60 * 12, // 12h
    },
    store: new SQLiteStore({
      client: db,
      expired: {
        clear: true,
        intervalMs: 1000 * 60 * 10, // limpa a cada 10 min
      },
    }),
  })
);

app.use(flash());

// Locals (flash + user)
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.usuario = req.session?.user || null;
  next();
});

// ===== Rotas =====
const authRoutes = require("./modules/auth/auth.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const equipamentosRoutes = require("./modules/equipamentos/equipamentos.routes");
const osRoutes = require("./modules/os/os.routes");
const preventivasRoutes = require("./modules/preventivas/preventivas.routes");
const escalaRoutes = require("./modules/escala/escala.routes");
const estoqueRoutes = require("./modules/estoque/estoque.routes");
const comprasRoutes = require("./modules/compras/compras.routes");
const motoresRoutes = require("./modules/motores/motores.routes");
const usuariosRoutes = require("./modules/usuarios/usuarios.routes");

app.use("/", authRoutes);
app.use("/", dashboardRoutes);
app.use("/equipamentos", equipamentosRoutes);
app.use("/os", osRoutes);
app.use("/preventivas", preventivasRoutes);
app.use("/escala", escalaRoutes);
app.use("/estoque", estoqueRoutes);
app.use("/", comprasRoutes); // (ex: /solicitacoes e /compras)
app.use("/motores", motoresRoutes);
app.use("/usuarios", usuariosRoutes);

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

// 404
app.use((req, res) => {
  res.status(404).send("404 - Página não encontrada");
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ ERRO:", err);
  res.status(500).send("500 - Erro interno");
});

// Start
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`🚀 Servidor ativo na porta ${PORT}`);
});
