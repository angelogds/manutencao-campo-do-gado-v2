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

// Railway/Proxy
app.set("trust proxy", 1);

// ===== View engine =====
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ===== Middlewares base =====
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// ✅ garante req.cookies mesmo sem cookie-parser (pra não quebrar rememberedEmail)
app.use((req, _res, next) => {
  if (!req.cookies) req.cookies = {};
  next();
});

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

// ===== Login Guard (req.authGuard) =====
const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 5);
const loginGuardStore = new Map(); // key -> { count, lockUntilTs }

function getIp(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = (xf || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  return ip || "unknown";
}
function guardKey(req, email) {
  return `${getIp(req)}::${String(email || "").toLowerCase()}`;
}
function getGuard(req, email) {
  const key = guardKey(req, email);
  const state = loginGuardStore.get(key) || { count: 0, lockUntilTs: 0 };
  loginGuardStore.set(key, state);
  return { key, state };
}
function isLocked(state) {
  return state.lockUntilTs && Date.now() < state.lockUntilTs;
}
function remainingSeconds(state) {
  return Math.max(1, Math.ceil((state.lockUntilTs - Date.now()) / 1000));
}
function attemptsLeft(state) {
  return Math.max(0, MAX_ATTEMPTS - Number(state.count || 0));
}

app.use((req, _res, next) => {
  req.authGuard = {
    MAX_ATTEMPTS,
    LOCK_MINUTES,
    getIp,
    guardKey,
    getGuard,
    isLocked,
    remainingSeconds,
    attemptsLeft,
    fail(req, email) {
      const { state } = getGuard(req, email);
      state.count = Number(state.count || 0) + 1;
      if (state.count >= MAX_ATTEMPTS) {
        state.lockUntilTs = Date.now() + LOCK_MINUTES * 60 * 1000;
      }
      return state;
    },
    success(req, email) {
      const { state } = getGuard(req, email);
      state.count = 0;
      state.lockUntilTs = 0;
      return state;
    },
  };
  next();
});

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

  // blindagens do layout/login
  res.locals.activeMenu = res.locals.activeMenu || "";
  res.locals.lockout = null;
  res.locals.attemptsLeft = null;
  res.locals.rememberedEmail = "";

  next();
});

// ✅ Seeds (admin + escala)
try {
  const seed = require("./database/seed");
  if (seed && typeof seed.ensureAdmin === "function") seed.ensureAdmin();
  if (seed && typeof seed.seedEscala2026 === "function") seed.seedEscala2026();
  if (seed && typeof seed.runSeeds === "function") seed.runSeeds();
} catch (err) {
  console.warn("⚠️ Seed não carregado:", err.message);
}

// ===== ROTAS =====
// Auth em /auth
app.use("/auth", require("./modules/auth/auth.routes"));

// Dashboard padronizado em /dashboard (router usa "/")
app.use("/dashboard", require("./modules/dashboard/dashboard.routes"));

// ⚠️ IMPORTANTE:
// Seus routers (os/estoque/escala/usuarios/preventivas/equipamentos) estão com paths tipo "/os", "/estoque", "/escala"... DENTRO.
// Então aqui no server eles devem ser montados em "/" (senão vira /os/os, /estoque/estoque etc).
app.use("/", require("./modules/equipamentos/equipamentos.routes"));
app.use("/", require("./modules/os/os.routes"));
app.use("/", require("./modules/preventivas/preventivas.routes"));
app.use("/", require("./modules/estoque/estoque.routes"));
app.use("/", require("./modules/escala/escala.routes"));
app.use("/", require("./modules/usuarios/usuarios.routes"));

// Compras (no seu compras.routes mais novo, você usa "/" e "/solicitacoes" etc)
// então ele TEM que ser montado em /compras
app.use("/compras", require("./modules/compras/compras.routes"));

// ===== Aliases para não quebrar links antigos =====
app.get("/login", (_req, res) => res.redirect("/auth/login"));

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
