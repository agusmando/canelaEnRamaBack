import express from "express";
import { SupplierController } from "../controllers/supplier.controller.js";
import { isAuthenticated, requireRole, STAFF_ROLES } from "../middleware/auth.middleware.js";
const router = express.Router();

const supplierController = new SupplierController();

const staff = STAFF_ROLES;

router.use(isAuthenticated);
router.use(requireRole(staff));

router
  .route("/")
  .get(supplierController.findAll.bind(supplierController))
  .post(supplierController.create.bind(supplierController));
router
  .route("/:id")
  .get(supplierController.findOne.bind(supplierController))
  .put(supplierController.update.bind(supplierController));
router
  .route("/:id/brands")
  .put(supplierController.addSupplierBrands.bind(supplierController))
  .delete(supplierController.removeSupplierBrands.bind(supplierController));
router
  .route("/:id/active/")
  .delete(supplierController.deactivate.bind(supplierController))
  .put(supplierController.activate.bind(supplierController));

export default router;
