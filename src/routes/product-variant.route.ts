import { verifySession } from "supertokens-node/recipe/session/framework/express";
import express from "express";
import { ProductVariantController } from "../controllers/product-variant.controller.ts";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.ts";

const router = express.Router();

const productVariantController = new ProductVariantController();

const adminRoles = ["Admin", "Employee"];

router
  .route("/:id")
  .get(productVariantController.findOne.bind(productVariantController))
  .put(
    isAuthenticated,
    requireRole(adminRoles),
    productVariantController.update.bind(productVariantController)
  );

export default router;
