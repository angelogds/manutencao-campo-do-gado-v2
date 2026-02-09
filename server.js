// ✅ .env só fora de produção (Railway usa Variables)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

require("./database/migrate");

const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const engine = require("ejs-mate");

const { requireLogin } = require("./modules/auth/auth.middleware");

// Rotas
const authRoutes = require("./modules/auth/auth.routes");
const comprasRoutes = require("./modules/compras/compras.routes");
const estoqueRoutes = require("./modules/estoque/estoque.routes");
const osRoutes = require("./modules/os/os.routes");
// const usuariosRoutes = require("./modules/usuarios/usuarios.routes"); // habilite quando existir

// ✅ Session store (remove warning MemoryStore)
const db = require("./database/db");
const SqliteStoreFactory = require("better-sqlite3-session-store")(session);
const sessionStore = new SqliteStoreFactory({
  client: db,
  expired: { clear: true, intervalMs: 15 * 60 * 1000 }, // 15min
});

const app = express();

// ✅ Railway proxy (necessário se usar cookie secure)
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ EJS + Layout engine
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ✅ estáticos (CSS/JS/IMG)
app.use(express.static(path.join(__dirname, "public")));

// ✅ sessão + flash (ANTES das rotas)
app.use(
  session({
    name: "cg.sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SESSION_SECURE_COOKIE === "true",
      maxAge: 1000 * 60 * 60 * 8, // 8h
    },
  })
);

app.use(flash());

// ✅ vars globais p/ views
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error"),
  };
  next();
});

// ✅ auth primeiro
app.use(authRoutes);

// ✅ módulos
app.use(comprasRoutes);
app.use(estoqueRoutes);
app.use(osRoutes);
// app.use(usuariosRoutes);

// ✅ home
app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

// ✅ dashboard com layout (ejs-mate)
app.get("/dashboard", requireLogin, (req, res) => {
  return res.render("dashboard/index", {
    layout: "layout",
    title: "Dashboard",
  });
});

// ✅ health
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    app: "manutencao-campo-do-gado-v2",
    timestamp: new Date().toISOString(),
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor ativo na porta ${port}`));
