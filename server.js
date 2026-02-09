// server.js
require("dotenv").config();
require("./database/migrate");

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const engine = require("ejs-mate");

// helper global de data BR
const { fmtBR, TZ } = require("./utils/date");

// seed admin (não quebra se já existir)
const { ensureAdmin } = require("./database/seed");
ensureAdmin();

const app = express();

// Railway / Proxy
app.set("trust proxy", 1);

// View engine
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Middlewares base
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Session + Flash (sem dependência extra)
app.use(
  session({
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

// Globals p/ EJS
app.locals.TZ = TZ;
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error"),
  };
  res.locals.fmtBR = fmtBR;
  res.locals.TZ = TZ;
  next();
});

// Rotas
const authRoutes = require("./modules/auth/auth.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const equipamentosRoutes = require("./modules/equipamentos/equipamentos.routes");
const osRoutes = require("./modules/os/os.routes");
const comprasRoutes = require("./modules/compras/compras.routes");
const estoqueRoutes = require("./modules/estoque/estoque.routes");
const usuariosRoutes = require("./modules/usuarios/usuarios.routes");

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(equipamentosRoutes);
app.use(osRoutes);
app.use(comprasRoutes);
app.use(estoqueRoutes);
app.use(usuariosRoutes);

// Home
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

// Health
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "manutencao-campo-do-gado-v2",
    timezone: TZ,
    utc: new Date().toISOString(),
  });
});

// 404
app.use((_req, res) => res.status(404).send("404 - Página não encontrada"));

// Error handler
app.use((err, _req, res, _next) => {
  console.error("❌ ERRO:", err);
  res.status(500).send("500 - Erro interno");
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Servidor ativo na porta ${port}`));
