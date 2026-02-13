// server.js
require("dotenv").config();
require("./database/migrate");

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const engine = require("ejs-mate");

// ✅ helper global de data/hora BR
const dateUtil = require("./utils/date");
const fmtBR =
  typeof dateUtil.fmtBR === "function" ? dateUtil.fmtBR : (v) => String(v ?? "-");
const TZ = dateUtil.TZ || "America/Sao_Paulo";

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
// ✅ LOGIN GUARD (bloqueio após X tentativas) — GLOBAL
// Use dentro do auth.controller via req.authGuard
// ======================================================
const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 5);
const loginGuardStore = new Map(); // key -> { count, lockUntilTs }

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
  return Math.max(1, Math.ceil((state.lockUntilTs - Date.now()) / 1000));
}

function attemptsLeft(state) {
  return Math.max(0, MAX_ATTEMPTS - Number(state.count || 0));
}

// Middleware: deixa helpers acessíveis no auth.controller
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

    // marca falha
    fail(req, email) {
      const { state } = getGuard(req, email);
      state.count = Number(state.count || 0) + 1;

      if (state.count >= MAX_ATTEMPTS) {
        state.lockUntilTs = Date.now() + LOCK_MINUTES * 60 * 1000;
      }
      return state;
    },

    // marca sucesso
    success(req, email) {
      const { state } = getGuard(req, email);
      state.count = 0;
      state.lockUntilTs = 0;
      return state;
    },
  };

  next();
});

// ===== Globals (disponível em todas as views) =====
app.locals.TZ = TZ;
app.locals.fmtBR = fmtBR;

app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;

  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error"),
  };

  // ✅ Disponível em TODO EJS
  res.locals.fmtBR = fmtBR;
  res.locals.TZ = TZ;

  // ✅ BLINDAGEM: evita crash em view/layout
  res.locals.lockout = null;
  res.locals.attemptsLeft = null;
  res.locals.rememberedEmail = "";

  // ✅ activeMenu sempre definido
  res.locals.activeMenu = res.locals.activeMenu || "dashboard";

  next();
});

// ✅ Seed (admin + escala 2026)
try {
  const { ensureAdmin, seedEscala2026 } = require("./database/seed");
  if (typeof ensureAdmin === "function") ensureAdmin();
  if (typeof seedEscala2026 === "function") seedEscala2026();
} catch (err) {
  console.warn("⚠️ Seed não carregado (./database/seed). Motivo:", err.message);
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
      console.error(`❌ [${name}] export inválido. Tipo:`, typeof mod);
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

// ===== Rotas (auth primeiro) =====
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

// ===== Debug =====
app.get("/debug-session", (req, res) => {
  res.json({
    hasSession: !!req.session,
    user: req.session?.user || null,
    cookieHeader: req.headers.cookie || null,
    secure: req.secure,
    xForwardedProto: req.headers["x-forwarded-proto"] || null,
    tz: TZ,
    nowBR: fmtBR(new Date()),
    fmtBRType: typeof fmtBR,
    loginGuard: {
      ip: getIp(req),
      maxAttempts: MAX_ATTEMPTS,
      lockMinutes: LOCK_MINUTES,
    },
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
