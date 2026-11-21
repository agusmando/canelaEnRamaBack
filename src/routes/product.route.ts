import express from "express";
import { ProductController } from "../controllers/product.controller.js";
import { attachRoles, optionalSession, requirePermission } from "../middleware/auth.middleware.js";
import { cloudinaryUpload, upload } from "../middleware/fileUploader.js";
import { hideCostForPublic, webOnlyForPublic } from "../middleware/publicView.js";

const router = express.Router();
const productController = new ProductController();
const publicView = [optionalSession, attachRoles, hideCostForPublic, webOnlyForPublic("product")];
const editCatalog = requirePermission("catalog.edit");
const deleteCatalog = requirePermission("catalog.delete");

router
  .route("/")
  .get(...publicView, productController.findAll.bind(productController))
  .post(
    ...editCatalog,
    upload.array("image", 7),
    cloudinaryUpload("products"),
    productController.create.bind(productController),
  );
router
  .route("/:id")
  .get(...publicView, productController.findOne.bind(productController))
  .put(...editCatalog, productController.update.bind(productController));
router
  .route("/:id/tags")
  .put(...editCatalog, productController.addProductTags.bind(productController))
  .delete(...editCatalog, productController.removeProductTags.bind(productController));
router
  .route("/:id/active/")
  .delete(...deleteCatalog, productController.deactivate.bind(productController))
  .put(...deleteCatalog, productController.activate.bind(productController));

export default router;
