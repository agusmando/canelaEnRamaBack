import express from "express";
import { ProductVariantController } from "../controllers/product-variant.controller.js";
import {
  attachRoles,
  isAuthenticated,
  optionalSession,
  requireRole,
  STAFF_ROLES,
} from "../middleware/auth.middleware.js";
import { cloudinaryUpload, upload } from "../middleware/fileUploader.js";
import { hideCostForPublic } from "../middleware/publicView.js";

const router = express.Router();
const productVariantController = new ProductVariantController();

const publicView = [optionalSession, attachRoles, hideCostForPublic];
// Orden: auth -> rol -> multer (parsea) -> cloudinary (sube)
const staffWithImages = [
  isAuthenticated,
  requireRole(STAFF_ROLES),
  upload.array("image", 7),
  cloudinaryUpload("products"),
];

router
  .route("/")
  .get(...publicView, productVariantController.findAll.bind(productVariantController))
  .post(...staffWithImages, productVariantController.create.bind(productVariantController));
router
  .route("/:id")
  .get(...publicView, productVariantController.findOne.bind(productVariantController))
  .put(...staffWithImages, productVariantController.update.bind(productVariantController));
router
  .route("/:id/active/")
  .delete(
    isAuthenticated,
    requireRole(STAFF_ROLES),
    productVariantController.deactivate.bind(productVariantController),
  )
  .put(
    isAuthenticated,
    requireRole(STAFF_ROLES),
    productVariantController.activate.bind(productVariantController),
  );

export default router;
