const router = require("express").Router();
const { requireLogin, requireRole } = require("../auth/auth.middleware");
const { ACCESS } = require("../../config/rbac");
const ctrl = require("./estoque.controller");

router.get("/", requireLogin, requireRole(ACCESS.estoque_view), ctrl.index);
router.get("/itens", requireLogin, requireRole(ACCESS.estoque_view), ctrl.itens);
router.get("/itens/novo", requireLogin, requireRole(ACCESS.estoque_manage), ctrl.novoItem);
router.post("/itens", requireLogin, requireRole(ACCESS.estoque_manage), ctrl.criarItem);
router.get("/itens/:id", requireLogin, requireRole(ACCESS.estoque_view), ctrl.showItem);

router.get("/categorias", requireLogin, requireRole(ACCESS.estoque_view), ctrl.categoriasIndex);
router.post("/categorias", requireLogin, requireRole(ACCESS.estoque_manage), ctrl.categoriasCreate);

router.get("/locais", requireLogin, requireRole(ACCESS.estoque_view), ctrl.locaisIndex);
router.post("/locais", requireLogin, requireRole(ACCESS.estoque_manage), ctrl.locaisCreate);

router.get("/movimentos", requireLogin, requireRole(ACCESS.estoque_view), ctrl.movimentosIndex);

router.get("/saidas/nova", requireLogin, requireRole(ACCESS.estoque_manage), ctrl.saidaNewForm);
router.post("/saidas", requireLogin, requireRole(ACCESS.estoque_manage), ctrl.saidaCreate);

module.exports = router;
