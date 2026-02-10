// server.js
require("dotenv").config();
require("./database/migrate");

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const engine = require("ejs-mate");

// helper global de data/hora BR
const { fmtBR, TZ } = require("./utils/date");

const app = express();

// Proxy Railway
app.set("trust proxy", 1);

// View engine
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Middlewares base
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Session + Flash
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

// Globals para EJS
app.locals.TZ = TZ;

app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error"),
  };

  res.locals.fmtBR = fmtBR;
  res.locals.TZ = TZ;

  // 🔒 Blindagem do menu
  res.locals.activeMenu = res.locals.activeMenu || "dashboard";

  next();
});

// Seed admin (opcional)
try {
  const { ensureAdmin } = require("./database/seed");
  if (typeof ensureAdmin === "function") ensureAdmin();
} catch (_) {
  console.warn("⚠️ Seed admin não carregado");
}

// Helpers de carga segura
function safeUse(name, mw) {
  if (typeof mw !== "function") {
    throw new Error(`Middleware inválido: ${name}`);
  }
  app.use(mw);
}

function safeModule(name, modulePath) {
  try {
    const mod = require(modulePath);
    safeUse(name, mod);
    console.log(`✅ Módulo carregado: ${name}`);
  } catch (e) {
    console.warn(`⚠️ Módulo NÃO carregado: ${name} -> ${e.message}`);
  }
}

// Rotas
safeModule("authRoutes", "./modules/auth/auth.routes");
safeModule("dashboardRoutes", "./modules/dashboard/dashboard.routes");
safeModule("comprasRoutes", "./modules/compras/compras.routes");
safeModule("estoqueRoutes", "./modules/estoque/estoque.routes");
safeModule("osRoutes", "./modules/os/os.routes");
safeModule("usuariosRoutes", "./modules/usuarios/usuarios.routes");
safeModule("equipamentosRoutes", "./modules/equipamentos/equipamentos.routes");
safeModule("preventivasRoutes", "./modules/preventivas/preventivas.routes");
safeModule("escalaRoutes", "./modules/escala/escala.routes");

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
    timestamp: new Date().toISOString(),
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
