const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ACCESS } = require("../../config/rbac");
const ctrl = require("./os.controller");

const OS_VIEW = ACCESS.os_view;
const OS_OPEN = ACCESS.os_open;
const OS_EXECUTE = ACCESS.os_execute;

const uploadDir = path.join(__dirname, "../../public/uploads/os");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (err) {
        cb(err);
      }
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`),
  }),
});

const wrap = (fn, name) =>
  typeof fn === "function"
    ? (req, res, next) => {
        res.locals.activeMenu = "os";
        try {
          return fn(req, res, next);
        } catch (err) {
          return next(err);
        }
      }
    : (_req, res) => {
        console.error(`❌ [os] Handler ${name} indefinido.`);
        return res.status(500).send(`Erro interno: handler ${name} indefinido.`);
      };

router.get("/", requireLogin, requireRole(OS_VIEW), wrap(ctrl.osIndex, "osIndex"));
router.get("/nova", requireLogin, requireRole(OS_OPEN), wrap(ctrl.osNewForm, "osNewForm"));
router.post(
  "/",
  requireLogin,
  requireRole(OS_OPEN),
  upload.fields([{ name: "abertura_fotos", maxCount: 10 }]),
  wrap(ctrl.osCreate, "osCreate")
);

router.get("/:id", requireLogin, requireRole(OS_VIEW), wrap(ctrl.osShow, "osShow"));
router.post("/:id/iniciar", requireLogin, requireRole(OS_EXECUTE), wrap(ctrl.osIniciar, "osIniciar"));
router.post("/:id/pausar", requireLogin, requireRole(OS_EXECUTE), wrap(ctrl.osPausar, "osPausar"));
router.post(
  "/:id/concluir",
  requireLogin,
  requireRole(OS_EXECUTE),
  upload.fields([{ name: "fechamento_fotos", maxCount: 10 }]),
  wrap(ctrl.osConcluir, "osConcluir")
);

router.post("/:id/status", requireLogin, requireRole(OS_EXECUTE), wrap(ctrl.osUpdateStatus, "osUpdateStatus"));

router.use((err, req, res, next) => {
  if (err && (err.code === "LIMIT_FILE_SIZE" || err.name === "MulterError" || err.code === "ENOENT" || err.code === "EACCES")) {
    console.error("❌ [os][upload]", err);
    req.flash("error", "Falha no upload das fotos. Verifique tamanho/permissão e tente novamente.");
    const osId = req.params?.id ? String(req.params.id) : "";
    if (osId) return res.redirect(`/os/${osId}`);
    return res.redirect("/os/nova");
  }
  return next(err);
});

module.exports = router;
