import express from "express";
import { SupplierController } from "../controllers/supplier.controller.js";
import { requirePermission, requirePermissionToWrite } from "../middleware/auth.middleware.js";
const router = express.Router();

const supplierController = new SupplierController();


// Ver: cualquier staff. Modificar: masters.edit.
router.use(requirePermission("dashboard.access"));
router.use(requirePermissionToWrite("masters.edit"));

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
