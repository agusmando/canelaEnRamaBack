import express from "express";
import { BrandController } from "../controllers/brand.controller.js";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
const router = express.Router();

const brandController = new BrandController();

const staff = ["ADMIN", "EMPLOYEE"];

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
    requireRole(["ADMIN"]),
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
