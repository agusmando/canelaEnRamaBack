import express from "express";
import { BrandController } from "../controllers/brand.controller.ts";
const router = express.Router();

const brandController = new BrandController();

router
  .route("/")
  .get(brandController.findAll.bind(brandController))
  .post(brandController.create.bind(brandController));
router
  .route("/:id")
  .get(brandController.findOne.bind(brandController))
  .put(brandController.update.bind(brandController));
router
  .route("/:id/products")
  .put(brandController.addBrandProducts.bind(brandController))
  .delete(brandController.removeBrandProductsTags.bind(brandController));
router
  .route("/:id/active/")
  .delete(brandController.deactivate.bind(brandController))
  .put(brandController.activate.bind(brandController));

export default router;
