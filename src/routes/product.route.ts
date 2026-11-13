import express from "express";
import { ProductController } from "../controllers/product.controller.js";
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
const productController = new ProductController();

const publicView = [optionalSession, attachRoles, hideCostForPublic];
const staff = [isAuthenticated, requireRole(STAFF_ROLES)];
const admin = [isAuthenticated, requireRole(["ADMIN"])];

router
  .route("/")
  .get(...publicView, productController.findAll.bind(productController))
  .post(
    ...staff,
    upload.array("image", 7),
    cloudinaryUpload("products"),
    productController.create.bind(productController),
  );
router
  .route("/:id")
  .get(...publicView, productController.findOne.bind(productController))
  .put(...staff, productController.update.bind(productController));
router
  .route("/:id/tags")
  .put(...staff, productController.addProductTags.bind(productController))
  .delete(...staff, productController.removeProductTags.bind(productController));
router
  .route("/:id/active/")
  .delete(...admin, productController.deactivate.bind(productController))
  .put(...admin, productController.activate.bind(productController));

export default router;
