import express from "express";
import { ProductVariantController } from "../controllers/product-variant.controller.js";
import {
  attachRoles,
  isAuthenticated,
  optionalSession,
  requirePermission,
  requirePermissionForBodyFields,
} from "../middleware/auth.middleware.js";
import { cloudinaryUpload, upload } from "../middleware/fileUploader.js";
import { hideCostForPublic, webOnlyForPublic } from "../middleware/publicView.js";

const router = express.Router();
const productVariantController = new ProductVariantController();
const publicView = [optionalSession, attachRoles, hideCostForPublic, webOnlyForPublic("variant")];
const stockPermissionForUpdate = requirePermissionForBodyFields(
  ["currentStock", "stockIncrement"],
  "stock.manage",
);
const stockPermissionForCreate = requirePermissionForBodyFields(
  ["currentStock"],
  "stock.manage",
  (value) => Number(value) > 0,
);
const staffWithImages = [
  ...requirePermission("catalog.edit"),
  upload.array("image", 7),
  stockPermissionForCreate,
  cloudinaryUpload("products"),
];

router
  .route("/")
  .get(...publicView, productVariantController.findAll.bind(productVariantController))
  .post(...staffWithImages, productVariantController.create.bind(productVariantController));
router
  .route("/:id")
  .get(...publicView, productVariantController.findOne.bind(productVariantController))
  .put(
    ...requirePermission("catalog.edit"),
    upload.array("image", 7),
    stockPermissionForUpdate,
    cloudinaryUpload("products"),
    productVariantController.update.bind(productVariantController),
  );
router.put(
  "/:id/stock",
  ...requirePermission("stock.manage"),
  productVariantController.adjustStock.bind(productVariantController),
);
router
  .route("/:id/active/")
  .delete(...requirePermission("catalog.delete"), productVariantController.deactivate.bind(productVariantController))
  .put(...requirePermission("catalog.delete"), productVariantController.activate.bind(productVariantController));

export default router;
