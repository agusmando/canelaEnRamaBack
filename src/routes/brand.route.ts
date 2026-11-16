import express from "express";
import { BrandController } from "../controllers/brand.controller.js";
import { attachRoles, optionalSession, requirePermission } from "../middleware/auth.middleware.js";
import { hideCostForPublic, hideProductsForPublic } from "../middleware/publicView.js";

// Sin sesión de staff no se exponen proveedores ni costos de los productos incluidos.
const publicView = [optionalSession, attachRoles, hideCostForPublic, hideProductsForPublic];
const router = express.Router();

const brandController = new BrandController();


router
  .route("/")
  .get(...publicView, brandController.findAll.bind(brandController))
  .post(
    ...requirePermission("masters.edit"),
    brandController.create.bind(brandController)
  );
router
  .route("/:id")
  .get(...publicView, brandController.findOne.bind(brandController))
  .put(
    ...requirePermission("masters.edit"),
    brandController.update.bind(brandController)
  );
router
  .route("/:id/products")
  .put(
    ...requirePermission("catalog.delete"),
    brandController.addBrandProducts.bind(brandController)
  )
  .delete(
    ...requirePermission("catalog.delete"),
    brandController.removeBrandProducts.bind(brandController)
  )
router
  .route("/:id/active/")
  .delete(
    ...requirePermission("masters.edit"),
    brandController.deactivate.bind(brandController)
  )
  .put(
    ...requirePermission("masters.edit"),
    brandController.activate.bind(brandController)
  );

export default router;
