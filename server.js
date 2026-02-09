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
const usuariosRoutes = require("./modules/usuarios/usuarios.routes");

// ✅ session store (remove MemoryStore warning)
const db = require("./database/db");
const SqliteStoreFactory = require("better-sqlite3-session-store")(session);
const sessionStore = new SqliteStoreFactory({
  client: db,
  expired: { clear: true, intervalMs: 24 * 60 * 60 * 1000 }
});

const app = express();
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

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
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error")
  };
  next();
});

app.use(authRoutes);
app.use(comprasRoutes);
app.use(estoqueRoutes);
app.use(osRoutes);
app.use(usuariosRoutes);

app.get("/", (req, res) => {
  if (req.session?.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

app.get("/dashboard", requireLogin, (req, res) => {
  return res.render("dashboard/index", { title: "Dashboard", layout: "layout" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    app: "manutencao-campo-do-gado-v2",
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor ativo na porta ${port}`));
