import express from "express";
import { ProductVariantController } from "../controllers/product-variant.controller.js";
import { attachRoles, optionalSession, requirePermission } from "../middleware/auth.middleware.js";
import { cloudinaryUpload, upload } from "../middleware/fileUploader.js";
import { hideCostForPublic, webOnlyForPublic } from "../middleware/publicView.js";

const router = express.Router();
const productVariantController = new ProductVariantController();

const publicView = [optionalSession, attachRoles, hideCostForPublic, webOnlyForPublic("variant")];
// Orden: auth -> rol -> multer (parsea) -> cloudinary (sube)
const staffWithImages = [
  ...requirePermission("catalog.edit"),
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
// Ajuste de stock: alcanza con stock.manage (no hace falta poder editar el catálogo)
router.put(
  "/:id/stock",
  ...requirePermission("stock.manage"),
  productVariantController.adjustStock.bind(productVariantController),
);

router
  .route("/:id/active/")
  .delete(
    ...requirePermission("catalog.edit"),
    productVariantController.deactivate.bind(productVariantController),
  )
  .put(
    ...requirePermission("catalog.edit"),
    productVariantController.activate.bind(productVariantController),
  );

export default router;
