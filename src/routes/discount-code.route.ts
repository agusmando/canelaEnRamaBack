import express from "express";
import { DiscountCodeController } from "../controllers/discount-code.controller.js";
import {
  attachRoles,
  isAuthenticated,
  requirePermission,
  requirePermissionToWrite,
} from "../middleware/auth.middleware.js";
const router = express.Router();

const discountCodeController = new DiscountCodeController();
const user = [isAuthenticated, attachRoles];

// Validación pública del checkout: cualquier cliente logueado (no solo staff).
// Va ANTES de los middlewares de staff.
router.post("/validate", ...user, discountCodeController.validate.bind(discountCodeController));

// ABM: cualquier staff lee; crear/editar usa el permiso de ofertas.
router.use(requirePermission("dashboard.access"));
router.use(requirePermissionToWrite("offers.edit"));

router
  .route("/")
  .get(discountCodeController.findAll.bind(discountCodeController))
  .post(discountCodeController.create.bind(discountCodeController));
router
  .route("/:id")
  .get(discountCodeController.findOne.bind(discountCodeController))
  .put(discountCodeController.update.bind(discountCodeController));
router
  .route("/:id/active/")
  .delete(discountCodeController.deactivate.bind(discountCodeController))
  .put(discountCodeController.activate.bind(discountCodeController));

export default router;
