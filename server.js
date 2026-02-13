// server.js
require("dotenv").config();
require("./database/migrate");

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const engine = require("ejs-mate");

// ===== Helper Data BR =====
const dateUtil = require("./utils/date");
const fmtBR =
  typeof dateUtil.fmtBR === "function" ? dateUtil.fmtBR : (v) => String(v ?? "-");
const TZ = dateUtil.TZ || "America/Sao_Paulo";

const app = express();
app.set("trust proxy", 1);

// ===== View Engine =====
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ===== Middlewares Base =====
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// ===== Session =====
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

// ======================================================
// LOGIN GUARD COMPLETO (COMPATÍVEL COM auth.controller)
// ======================================================

const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 5);
const loginGuardStore = new Map();

function getIp(req) {
  const xf = req.headers["x-forwarded-for"];
  const ip = (xf || req.socket.remoteAddress || "")
    .toString()
    .split(",")[0]
    .trim();
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
  return Math.max(
    1,
    Math.ceil((state.lockUntilTs - Date.now()) / 1000)
  );
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

// ===== Globals para EJS =====
app.locals.TZ = TZ;
app.locals.fmtBR = fmtBR;

app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;

  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error"),
  };

  res.locals.fmtBR = fmtBR;
  res.locals.TZ = TZ;
  res.locals.lockout = null;
  res.locals.attemptsLeft = null;
  res.locals.rememberedEmail = "";
  res.locals.activeMenu = "dashboard";

  next();
});

// ===== Seed =====
try {
  const { ensureAdmin, seedEscala2026 } = require("./database/seed");
  if (typeof ensureAdmin === "function") ensureAdmin();
  if (typeof seedEscala2026 === "function") seedEscala2026();
} catch (err) {
  console.warn("⚠️ Seed não carregado:", err.message);
}

// ======================================================
// SAFE MODULE (ACEITA ROUTER)
// ======================================================

function safeModule(name, modulePath) {
  try {
    const mod = require(modulePath);

    if (!mod) {
      console.error(`❌ [${name}] módulo vazio`);
      return;
    }

    app.use(mod);
    console.log(`✅ Módulo carregado: ${name}`);
  } catch (e) {
    console.warn(`⚠️ Módulo NÃO carregado: ${name}`);
    console.warn(e.message);
  }
}

// ===== Rotas =====
safeModule("authRoutes", "./modules/auth/auth.routes");
safeModule("dashboardRoutes", "./modules/dashboard/dashboard.routes");
safeModule("comprasRoutes", "./modules/compras/compras.routes");
safeModule("estoqueRoutes", "./modules/estoque/estoque.routes");
safeModule("osRoutes", "./modules/os/os.routes");
safeModule("usuariosRoutes", "./modules/usuarios/usuarios.routes");
safeModule("equipamentosRoutes", "./modules/equipamentos/equipamentos.routes");
safeModule("preventivasRoutes", "./modules/preventivas/preventivas.routes");
safeModule("escalaRoutes", "./modules/escala/escala.routes");

// ===== Home =====
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

// ===== Health =====
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timezone: TZ,
    timestamp_utc: new Date().toISOString(),
  });
});

// ===== 404 =====
app.use((_req, res) =>
  res.status(404).send("404 - Página não encontrada")
);

// ===== Error Handler =====
app.use((err, _req, res, _next) => {
  console.error("❌ ERRO:", err);
  res.status(500).send("500 - Erro interno");
});

const port = process.env.PORT || 8080;
app.listen(port, () =>
  console.log(`🚀 Servidor ativo na porta ${port}`)
);
