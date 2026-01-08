import express from "express";
import { BrandController } from "../controllers/brand.controller.ts";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.ts";
const router = express.Router();

const brandController = new BrandController();

const staff = ["Admin", "Employee"];

router
  .route("/")
  .get(brandController.findAll.bind(brandController))
  .post(
    isAuthenticated,
    requireRole(staff),
    brandController.create.bind(brandController)
  );
router
  .route("/:id")
  .get(brandController.findOne.bind(brandController))
  .put(
    isAuthenticated,
    requireRole(staff),
    brandController.update.bind(brandController)
  );
router
  .route("/:id/products")
  .put(
    isAuthenticated,
    requireRole(["Admin"]),
    brandController.addBrandProducts.bind(brandController)
  )
router
  .route("/:id/active/")
  .delete(
    isAuthenticated,
    requireRole(staff),
    brandController.deactivate.bind(brandController)
  )
  .put(
    isAuthenticated,
    requireRole(staff),
    brandController.activate.bind(brandController)
  );

export default router;
