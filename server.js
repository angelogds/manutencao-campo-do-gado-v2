// /server.js
require("dotenv").config();

try {
  require("./database/migrate");
  console.log("✅ Migrations carregadas");
} catch (err) {
  console.error("❌ Erro nas migrations:", err.message);
}

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const engine = require("ejs-mate");

const dateUtil = require("./utils/date");
const fmtBR =
  typeof dateUtil.fmtBR === "function" ? dateUtil.fmtBR : (v) => String(v ?? "-");
const TZ = dateUtil.TZ || "America/Sao_Paulo";

const app = express();
app.set("trust proxy", 1);

function mountRoute(basePath, routeModulePath) {
  try {
    app.use(basePath, require(routeModulePath));
  } catch (err) {
    console.error(`❌ [routes] Falha ao carregar ${routeModulePath}:`, err.message || err);
    app.use(basePath, (_req, res) => {
      res.status(503).send(`Módulo temporariamente indisponível: ${basePath}`);
    });
  }
}

// ===== View engine =====
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ===== Middlewares base =====
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// ===== Session + Flash =====
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

// ===== Globals (views) =====
app.locals.TZ = TZ;
app.locals.fmtBR = fmtBR;

app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flash = {
    success: req.flash("success") || [],
    error: req.flash("error") || [],
  };
  res.locals.fmtBR = fmtBR;
  res.locals.TZ = TZ;

  // evita crash no layout
  res.locals.activeMenu = res.locals.activeMenu || "";

  // compatibilidade com layouts antigos que esperam variáveis globais
  res.locals.resumoOS = res.locals.resumoOS || {
    abertas: 0,
    andamento: 0,
    fechadas: 0,
  };

  next();
});

// ✅ Seeds
try {
  const seed = require("./database/seed");
  if (seed && typeof seed.runSeeds === "function") seed.runSeeds();
  else if (seed && typeof seed.ensureAdmin === "function") seed.ensureAdmin();
} catch (err) {
  console.warn("⚠️ Seed não carregado:", err.message);
}

// ===== ROTAS =====
mountRoute('/auth', './modules/auth/auth.routes');
mountRoute('/dashboard', './modules/dashboard/dashboard.routes');
mountRoute('/pcm', './modules/pcm/pcm.routes');
mountRoute('/equipamentos', './modules/equipamentos/equipamentos.routes');
mountRoute('/os', './modules/os/os.routes');
mountRoute('/preventivas', './modules/preventivas/preventivas.routes');
mountRoute('/compras', './modules/compras/compras.routes');
mountRoute('/solicitacoes', './modules/solicitacoes/solicitacoes.routes');
mountRoute('/estoque', './modules/estoque/estoque.routes');
mountRoute('/almoxarifado', './modules/almoxarifado/almoxarifado.routes');
mountRoute('/escala', './modules/escala/escala.routes');
mountRoute('/avisos', './modules/avisos/avisos.routes');
mountRoute('/usuarios', './modules/usuarios/usuarios.routes');
mountRoute('/demandas', './modules/demandas/demandas.routes');
mountRoute('/motores', './modules/motores/motores.routes'); // ✅ motores

// ===== Home =====
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/auth/login");
});

app.get('/painel-operacional', (req, res) => {
  if (!req.session?.user) return res.redirect('/auth/login');
  return res.redirect('/dashboard');
});

// ===== Health =====
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    app: "manutencao-campo-do-gado-v2",
    timezone: TZ,
    timestamp_utc: new Date().toISOString(),
  });
});

// ===== 404 =====
app.use((_req, res) => res.status(404).send("404 - Página não encontrada"));

// ===== Error handler =====
app.use((err, _req, res, _next) => {
  console.error("❌ ERRO:", err);
  res.status(500).send("500 - Erro interno");
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`🚀 Servidor ativo na porta ${port}`));
