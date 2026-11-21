import express from "express";
import { BrandController } from "../controllers/brand.controller.js";
import { isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";
const router = express.Router();

const brandController = new BrandController();

const manageMasters = [isAuthenticated, requirePermission("masters.edit")];

router
  .route("/")
  .get(brandController.findAll.bind(brandController))
  .post(
    ...manageMasters,
    brandController.create.bind(brandController)
  );
router
  .route("/:id")
  .get(brandController.findOne.bind(brandController))
  .put(
    ...manageMasters,
    brandController.update.bind(brandController)
  );
router
  .route("/:id/products")
  .put(
    ...manageMasters,
    brandController.addBrandProducts.bind(brandController)
  )
  .delete(
    ...manageMasters,
    brandController.removeBrandProducts.bind(brandController)
  )
router
  .route("/:id/active/")
  .delete(
    ...manageMasters,
    brandController.deactivate.bind(brandController)
  )
  .put(
    ...manageMasters,
    brandController.activate.bind(brandController)
  );

export default router;
