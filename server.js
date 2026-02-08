// Carrega .env só fora de produção (no Railway, use Variables)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const path = require("path");

const { requireLogin } = require("./modules/auth/auth.middleware");

// ✅ DB (better-sqlite3) do seu projeto (ajuste o caminho se necessário)
const db = require("./database/db");

// ✅ Store de sessão em SQLite (não usa MemoryStore)
const SqliteStoreFactory = require("better-sqlite3-session-store")(session);
const sessionStore = new SqliteStoreFactory({
  client: db,
  expired: {
    clear: true,
    intervalMs: 15 * 60 * 1000, // 15 min
  },
});

const app = express();
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    },
  })
);

app.use(flash());
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.messages = req.flash();
  next();
});

app.use("/", require("./modules/auth/auth.routes"));
app.use("/dashboard", requireLogin, require("./modules/dashboard/dashboard.routes"));
app.use("/solicitacoes", requireLogin, require("./modules/compras/solicitacoes.routes"));
app.use("/compras", requireLogin, require("./modules/compras/compras.routes"));
app.use("/os", requireLogin, require("./modules/os/os.routes"));
app.use("/admin/users", requireLogin, require("./modules/usuarios/usuarios.routes"));

app.get("/", (req, res) => res.redirect("/dashboard"));
app.listen(process.env.PORT || 3000, () => console.log("Running"));
