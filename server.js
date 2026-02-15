// server.js
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

  next();
});

// ✅ Seeds (admin + escala)
try {
  const seed = require("./database/seed");
  if (seed && typeof seed.runSeeds === "function") seed.runSeeds();
  else if (seed && typeof seed.ensureAdmin === "function") seed.ensureAdmin();
  if (seed && typeof seed.seedEscala2026 === "function") seed.seedEscala2026();
} catch (err) {
  console.warn("⚠️ Seed não carregado:", err.message);
}

// =====================================================
// ✅ ROTAS
// =====================================================

// Auth fica em /auth
app.use("/auth", require("./modules/auth/auth.routes"));

// Compras fica em /compras (porque o compras.routes usa "/" e "/solicitacoes")
app.use("/compras", require("./modules/compras/compras.routes"));

// ✅ IMPORTANTE:
// Os módulos abaixo (no seu projeto) estão com rotas tipo "/os", "/estoque", "/preventivas", "/escala", "/usuarios" etc.
// Então eles precisam ser montados no "/" para NÃO virar /os/os, /estoque/estoque etc.
app.use("/", require("./modules/dashboard/dashboard.routes"));
app.use("/", require("./modules/equipamentos/equipamentos.routes"));
app.use("/", require("./modules/os/os.routes"));
app.use("/", require("./modules/preventivas/preventivas.routes"));
app.use("/", require("./modules/estoque/estoque.routes"));
app.use("/", require("./modules/escala/escala.routes"));
app.use("/", require("./modules/usuarios/usuarios.routes"));

// =====================================================
// ✅ COMPATIBILIDADE (evita 404 por links antigos)
// =====================================================

// se algum lugar ainda aponta /login
app.get("/login", (_req, res) => res.redirect("/auth/login"));

// se algum lugar ainda aponta /logout via GET (opcional)
app.get("/logout", (_req, res) => res.redirect("/auth/login"));

// Se seu dashboard.routes estiver como "/dashboard" (ou "/dashboard/dashboard"), isso ajuda.
app.get("/dashboard", (req, res, next) => {
  // tenta seguir fluxo normal: se existir rota /dashboard no router montado em "/"
  // se não existir, redireciona para /dashboard/dashboard (que acontece quando router tem "/dashboard" e foi montado em "/dashboard")
  // como aqui montamos em "/", o mais comum é já existir /dashboard.
  // mas deixo fallback para o caso de seu dashboard.routes estar com "/dashboard/dashboard".
  try {
    return next();
  } catch (_e) {
    return res.redirect("/dashboard/dashboard");
  }
});

// ===== Home =====
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/auth/login");
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
