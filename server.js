require("dotenv").config();
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

const app = express();

/* =======================
   CONFIG BÁSICA
======================= */
app.set("trust proxy", 1); // ✅ OBRIGATÓRIO no Railway

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* =======================
   EJS + LAYOUT
======================= */
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

/* =======================
   ARQUIVOS ESTÁTICOS
======================= */
app.use(express.static(path.join(__dirname, "public")));

/* =======================
   SESSÃO (RAILWAY SAFE)
======================= */
app.use(
  session({
    name: "cg.sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: "auto", // ✅ resolve HTTPS do Railway
      maxAge: 1000 * 60 * 60 * 12, // 12h
    },
  })
);

app.use(flash());

/* =======================
   VARIÁVEIS GLOBAIS (EJS)
======================= */
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = {
    success: req.flash("success"),
    error: req.flash("error"),
  };
  next();
});

/* =======================
   ROTAS
======================= */
app.use(authRoutes);
app.use(comprasRoutes);
app.use(estoqueRoutes);
app.use(osRoutes);
app.use(usuariosRoutes);

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  return res.redirect("/login");
});

/* =======================
   DASHBOARD
======================= */
app.get("/dashboard", requireLogin, (req, res) => {
  res.render("dashboard/index", { title: "Dashboard" });
});

/* =======================
   DEBUG (TEMPORÁRIO)
======================= */
app.get("/debug/session", (req, res) => {
  res.json({ session: req.session });
});

/* =======================
   START
======================= */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor ativo na porta ${port}`);
});
