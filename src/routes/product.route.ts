import { verifySession } from "supertokens-node/recipe/session/framework/express";
import express from "express";
import { ProductController } from "../controllers/product.controller.ts";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.ts";
import productVariantRoutes from "./product-variant.route.ts";
import { cloudinaryUpload, upload } from "../middleware/fileUploader.ts";

const router = express.Router();

const productController = new ProductController();

const adminRoles = ["Admin", "Employee"];

router.route("/").get(productController.findAll.bind(productController)).post(
  isAuthenticated,
  requireRole(adminRoles),
  upload.single("image"),
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
    requireRole(["Admin"]),
    productController.deactivate.bind(productController)
  )
  .put(
    isAuthenticated,
    requireRole(["Admin"]),
    productController.activate.bind(productController)
  );
export default router;
