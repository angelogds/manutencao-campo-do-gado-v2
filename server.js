// server.js
require("dotenv").config();

// aplica migrations
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

// helper global de data/hora
const dateUtil = require("./utils/date");
const fmtBR =
  typeof dateUtil.fmtBR === "function"
    ? dateUtil.fmtBR
    : (v) => String(v ?? "-");
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

// ===== Globals =====
app.locals.TZ = TZ;
app.locals.fmtBR = fmtBR;

app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;

  res.locals.flash = {
    success: req.flash("success") || [],
    error: req.flash("error") || [],
  };

  // blindagens para views/layout
  res.locals.fmtBR = fmtBR;
  res.locals.TZ = TZ;

  res.locals.lockout = null;
  res.locals.attemptsLeft = null;
  res.locals.rememberedEmail = "";

  // ✅ sempre definido para evitar “activeMenu is not defined”
  res.locals.activeMenu = res.locals.activeMenu || "";

  next();
});

// ===== Seeds (admin + escala) =====
try {
  const seed = require("./database/seed");
  if (seed && typeof seed.runSeeds === "function") seed.runSeeds();
  else if (seed && typeof seed.ensureAdmin === "function") seed.ensureAdmin();
} catch (err) {
  console.warn("⚠️ Seed não carregado:", err.message);
}

// ===== Aliases (evita erro por links antigos) =====
app.get("/login", (_req, res) => res.redirect("/auth/login"));
app.post("/logout", (req, res) => {
  // encaminha para rota oficial
  req.url = "/logout";
  return require("./modules/auth/auth.routes")(req, res);
});

// ===== Rotas =====
app.use("/auth", require("./modules/auth/auth.routes"));

// ✅ IMPORTANTE: dashboard routes agora é "/"
app.use("/dashboard", require("./modules/dashboard/dashboard.routes"));

app.use("/compras", require("./modules/compras/compras.routes"));
app.use("/estoque", require("./modules/estoque/estoque.routes"));
app.use("/os", require("./modules/os/os.routes"));
app.use("/usuarios", require("./modules/usuarios/usuarios.routes"));
app.use("/equipamentos", require("./modules/equipamentos/equipamentos.routes"));
app.use("/preventivas", require("./modules/preventivas/preventivas.routes"));
app.use("/escala", require("./modules/escala/escala.routes"));

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
app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
