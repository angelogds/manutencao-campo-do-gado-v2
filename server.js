// server.js
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const path = require("path");
const engine = require("ejs-mate");
const db = require("./database/db");

const { runMigrations } = require("./database/migrate");

const app = express();

// view engine
app.engine("ejs", engine);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// static
app.use(express.static(path.join(__dirname, "public")));

// body
app.use(express.urlencoded({ extended: true }));

// sessions
app.use(
  session({
    store: new SQLiteStore({
      db: path.basename(process.env.DB_PATH || "sessions.sqlite"),
      dir: path.dirname(process.env.DB_PATH || path.join(__dirname, "database")),
    }),
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
  })
);

// globals (locals)
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;

  // evita crash no layout
  res.locals.activeMenu = res.locals.activeMenu || "";

  // 🔔 Badge de motores em rebobinamento (mostra só se tiver)
  // Não pode derrubar a aplicação se ainda não existir tabela/migration.
  res.locals.motorBadgeCount = 0;
  if (req.session?.user) {
    try {
      const row = db
        .prepare(
          "SELECT COUNT(*) AS total FROM motores WHERE status = 'ENVIADO_REBOB'"
        )
        .get();
      res.locals.motorBadgeCount = row?.total || 0;
    } catch (e) {
      // silencioso
    }
  }

  next();
});

// routes
const authRoutes = require("./modules/auth/auth.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const equipamentosRoutes = require("./modules/equipamentos/equipamentos.routes");
const osRoutes = require("./modules/os/os.routes");
const preventivasRoutes = require("./modules/preventivas/preventivas.routes");
const comprasRoutes = require("./modules/compras/compras.routes");
const estoqueRoutes = require("./modules/estoque/estoque.routes");
const motoresRoutes = require("./modules/motores/motores.routes");
const escalaRoutes = require("./modules/escala/escala.routes");

// mount
app.use("/", authRoutes);
app.use("/", dashboardRoutes);
app.use("/", equipamentosRoutes);
app.use("/", osRoutes);
app.use("/", preventivasRoutes);
app.use("/", comprasRoutes);
app.use("/", estoqueRoutes);
app.use("/", motoresRoutes);
app.use("/", escalaRoutes);

// start
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    runMigrations();
    app.listen(PORT, () => console.log(`✅ Server rodando na porta ${PORT}`));
  } catch (err) {
    console.error("❌ Falha ao iniciar:", err);
    process.exit(1);
  }
})();
