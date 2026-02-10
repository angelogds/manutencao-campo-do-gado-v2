// server.js
require("dotenv").config();
require("./database/migrate");

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const engine = require("ejs-mate");

// ✅ helper global de data/hora BR
const { fmtBR, TZ } = require("./utils/date");

const app = express();

// ✅ Railway/Proxy (resolve login que “não segura” sessão em HTTPS)
app.set("trust proxy", 1);

// ===== View engine =====
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ===== Middlewares base =====
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// ===== Session + Flash (ANTES das rotas) =====
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: "auto", // express-session v1.17+ suporta "auto"
    },
  })
);

app.use(flash());

// ===== Globals (disponível em todas as views) =====
app.locals.TZ = TZ;

app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error"),
  };

  // ✅ Disponível em TODO EJS: <%= fmtBR(data) %>
  res.locals.fmtBR = fmtBR;
  res.locals.TZ = TZ;

  next();
});

// ✅ Seed (não derruba o servidor se o arquivo não existir)
try {
  // precisa existir: /database/seed.js
  const { ensureAdmin } = require("./database/seed");
  if (typeof ensureAdmin === "function") {
    ensureAdmin();
  } else {
    console.warn("⚠️ ensureAdmin não é função em ./database/seed");
  }
} catch (err) {
  console.warn("⚠️ Seed não carregado (./database/seed). Motivo:", err.message);
  console.warn("👉 Crie o arquivo: database/seed.js para ativar o seed do admin.");
}

// ===== Helpers de carga segura =====
function safeUse(name, mw) {
  if (typeof mw !== "function") {
    console.error(`❌ ROTA/MIDDLEWARE inválido: ${name}`, typeof mw, mw);
    throw new Error(`Middleware inválido: ${name}`);
  }
  app.use(mw);
}

function safeModule(name, modulePath) {
  try {
    const mod = require(modulePath);
    if (typeof mod !== "function") {
      console.error(`❌ [${name}] export inválido (precisa exportar router function). Tipo:`, typeof mod);
      return { ok: false, err: `export inválido (${typeof mod})` };
    }
    safeUse(name, mod);
    console.log(`✅ Módulo carregado: ${name}`);
    return { ok: true };
  } catch (e) {
    console.warn(`⚠️ Módulo NÃO carregado: ${name} -> ${e.message}`);
    console.warn(`👉 Verifique o arquivo: ${modulePath}`);
    return { ok: false, err: e.message };
  }
}

// ===== Rotas principais (auth primeiro) =====
safeModule("authRoutes", "./modules/auth/auth.routes");
safeModule("dashboardRoutes", "./modules/dashboard/dashboard.routes");
safeModule("comprasRoutes", "./modules/compras/compras.routes");
safeModule("estoqueRoutes", "./modules/estoque/estoque.routes");
safeModule("osRoutes", "./modules/os/os.routes");
safeModule("usuariosRoutes", "./modules/usuarios/usuarios.routes");
safeModule("equipamentosRoutes", "./modules/equipamentos/equipamentos.routes");

// ===== ✅ PREPARO: Preventivas (pode entrar agora sem quebrar) =====
// Assim que você colar o módulo preventivas, ele já sobe.
// Rota base esperada: /preventivas
safeModule("preventivasRoutes", "./modules/preventivas/preventivas.routes");

// ===== ✅ PREPARO: Escala (módulo futuro, já “plugável”) =====
// Quando iniciarmos Escala, basta criar modules/escala/escala.routes.js
// Rota base esperada: /escala
safeModule("escalaRoutes", "./modules/escala/escala.routes");

// ===== Home =====
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

// ===== Debug (remova depois) =====
app.get("/debug-session", (req, res) => {
  res.json({
    hasSession: !!req.session,
    user: req.session?.user || null,
    cookieHeader: req.headers.cookie || null,
    secure: req.secure,
    xForwardedProto: req.headers["x-forwarded-proto"] || null,
    tz: TZ,
    nowBR: fmtBR(new Date()),
  });
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
app.listen(port, () => console.log(`Servidor ativo na porta ${port}`));
