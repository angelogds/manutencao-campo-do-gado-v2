// .env só em desenvolvimento (Railway usa Variables)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// migrations sempre ao iniciar
require("./database/migrate");

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");

// ✅ session store em SQLite (remove MemoryStore warning)
const db = require("./database/db");
const SqliteStoreFactory = require("better-sqlite3-session-store")(session);
const sessionStore = new SqliteStoreFactory({
  client: db,
  expired: { clear: true, intervalMs: 15 * 60 * 1000 } // 15 min
});

const { requireLogin } = require("./modules/auth/auth.middleware");
const authRoutes = require("./modules/auth/auth.routes");

const app = express();

// ✅ Railway / HTTPS proxy
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// estáticos
app.use(express.static(path.join(__dirname, "public")));

// ✅ sessão ANTES das rotas
app.use(
  session({
    name: "cg.sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // ✅ aqui remove o warning
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // em produção, se quiser cookie seguro:
      secure: process.env.SESSION_SECURE_COOKIE === "true",
      maxAge: 1000 * 60 * 60 * 8 // 8h
    }
  })
);

// flash DEPOIS da sessão
app.use(flash());

// vars globais p/ views
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error"),
  };
  next();
});

// auth
app.use(authRoutes);

// home
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

// dashboard
app.get("/dashboard", requireLogin, (req, res) => {
  return res.render("dashboard/index", { title: "Dashboard" });
});

// health
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    app: "manutencao-campo-do-gado-v2",
    timestamp: new Date().toISOString(),
  });
});

// 404 opcional (recomendado)
app.use((_req, res) => {
  return res.status(404).render("errors/404", { title: "Não encontrado" });
});

// erro opcional (recomendado)
app.use((err, _req, res, _next) => {
  console.error("Erro na aplicação:", err);
  return res.status(500).render("errors/500", { title: "Erro interno" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor ativo na porta ${port}`));
