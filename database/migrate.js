require("dotenv").config();
require("./database/migrate");

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");

const { requireLogin } = require("./modules/auth/auth.middleware");
const authRoutes = require("./modules/auth/auth.routes");

const app = express();

// ✅ Proxy (Railway) — necessário se você usar secure cookies no futuro
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ✅ arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// ✅ sessão (antes das rotas)
app.use(
  session({
    name: "cg.sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // ✅ em produção (Railway com HTTPS), deixe true usando SESSION_SECURE_COOKIE=true
      secure: process.env.SESSION_SECURE_COOKIE === "true",
      maxAge: 1000 * 60 * 60 * 8, // 8h
    },
  })
);

// ✅ flash (depois da sessão)
app.use(flash());

// ✅ vars globais (para EJS)
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error"),
  };
  next();
});

// ✅ auth routes (/login, /logout, etc.)
app.use(authRoutes);

// ✅ home
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

// ✅ dashboard protegido
app.get("/dashboard", requireLogin, (req, res) => {
  return res.render("dashboard/index", { title: "Dashboard" });
});

// ✅ health (Railway)
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    app: "manutencao-campo-do-gado-v2",
    timestamp: new Date().toISOString(),
  });
});

// ✅ 404 (evita “Internal Server Error” por rota faltando)
app.use((_req, res) => {
  return res.status(404).render("errors/404", { title: "Não encontrado" });
});

// ✅ handler de erro (mostra log e não derruba tudo)
app.use((err, _req, res, _next) => {
  console.error("Erro na aplicação:", err);
  return res.status(500).render("errors/500", { title: "Erro interno" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor ativo na porta ${port}`));
