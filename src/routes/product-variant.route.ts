import express from "express";
import { ProductVariantController } from "../controllers/product-variant.controller.js";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
import { cloudinaryUpload, upload } from "../middleware/fileUploader.js";

const router = express.Router();

const productVariantController = new ProductVariantController();

const adminRoles = ["Admin", "Employee"];

router.route("/")  
  .post(
    isAuthenticated,
    requireRole(adminRoles),
    cloudinaryUpload("products"),
    upload.array("image", 7),
    productVariantController.create.bind(productVariantController),
  );
router
  .route("/:id")
  .get(productVariantController.findOne.bind(productVariantController))
  .put(
    isAuthenticated,
    upload.array("image", 7),
    cloudinaryUpload("products"),
    requireRole(adminRoles),
    productVariantController.update.bind(productVariantController),
  );

export default router;
