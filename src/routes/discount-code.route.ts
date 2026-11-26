import express from "express";
import { DiscountCodeController } from "../controllers/discount-code.controller.js";
import {
  attachRoles,
  optionalSession,
  requirePermission,
  requirePermissionToWrite,
} from "../middleware/auth.middleware.js";
const router = express.Router();

const discountCodeController = new DiscountCodeController();

// Vista previa pública del checkout: invitados también pueden ver el descuento
// (el límite por usuario se exige recién en resolveForOrder, con sesión).
// Va ANTES de los middlewares de staff.
router.post("/validate", optionalSession, attachRoles, discountCodeController.validate.bind(discountCodeController));

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
