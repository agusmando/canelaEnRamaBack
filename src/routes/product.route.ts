import express from "express";
import { ProductController } from "../controllers/product.controller.js";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";
import { cloudinaryUpload, upload } from "../middleware/fileUploader.js";

const router = express.Router();

const productController = new ProductController();

const adminRoles = ["ADMIN", "EMPLOYEE"];

router
  .route("/")
  .get(productController.findAll.bind(productController))
  .post(
    isAuthenticated,
    requireRole(adminRoles),
    upload.array("image", 7),
    cloudinaryUpload("products"),
    productController.create.bind(productController)
  );
router
  .route("/:id")
  .get(productController.findOne.bind(productController))
  .put(
    isAuthenticated,
    requireRole(adminRoles),
    productController.update.bind(productController)
  );
router
  .route("/:id/tags")
  .put(
    isAuthenticated,
    requireRole(adminRoles),
    productController.addProductTags.bind(productController)
  )
  .delete(productController.removeProductTags.bind(productController));
router
  .route("/:id/active/")
  .delete(
    isAuthenticated,
    requireRole(["ADMIN"]),
    productController.deactivate.bind(productController)
  )
  .put(
    isAuthenticated,
    requireRole(["ADMIN"]),
    productController.activate.bind(productController)
  );
export default router;
