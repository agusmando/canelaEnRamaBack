import express from "express";
import { ProductVariantController } from "../controllers/product-variant.controller.ts";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.ts";
import { cloudinaryUpload, upload } from "../middleware/fileUploader.ts";

const router = express.Router();

const productVariantController = new ProductVariantController();

const adminRoles = ["Admin", "Employee"];

router
  .route("/:id")
  .get(productVariantController.findOne.bind(productVariantController))
  .put(
    isAuthenticated,
    upload.array("image", 7),
    cloudinaryUpload("products"),
    requireRole(adminRoles),
    productVariantController.update.bind(productVariantController)
  );

export default router;
