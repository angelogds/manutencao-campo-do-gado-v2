// ================= CONFIG =================
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

const app = express();
app.set("trust proxy", 1);

// ================= VIEW ENGINE =================
app.engine("ejs", engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ================= MIDDLEWARES =================
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

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

// ================= VARIÁVEIS GLOBAIS NAS VIEWS =================
app.use((req, res, next) => {
  res.locals.flash = {
    success: req.flash("success") || [],
    error: req.flash("error") || [],
  };

  res.locals.user = req.session?.user || null;

  // 👇 IMPORTANTE: evita erro activeMenu undefined
  res.locals.activeMenu = "";

  next();
});

// ================= TESTE =================
app.get("/teste", (req, res) => {
  res.send("SERVIDOR OK");
});

// ================= ROTAS =================
app.use("/auth", require("./modules/auth/auth.routes"));
app.use("/dashboard", require("./modules/dashboard/dashboard.routes"));
app.use("/compras", require("./modules/compras/compras.routes"));
app.use("/estoque", require("./modules/estoque/estoque.routes"));
app.use("/os", require("./modules/os/os.routes"));
app.use("/usuarios", require("./modules/usuarios/usuarios.routes"));
app.use("/equipamentos", require("./modules/equipamentos/equipamentos.routes"));
app.use("/preventivas", require("./modules/preventivas/preventivas.routes"));
app.use("/escala", require("./modules/escala/
