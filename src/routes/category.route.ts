import express from "express";
import { CategoryController } from "../controllers/category.controller.js";
import { attachRoles, optionalSession, requirePermission } from "../middleware/auth.middleware.js";
import { hideCostForPublic } from "../middleware/publicView.js";

// Sin sesión de staff no se exponen proveedores ni costos de los productos incluidos.
const publicView = [optionalSession, attachRoles, hideCostForPublic];
const router = express.Router();

const categoryController = new CategoryController();


router
  .route("/")
  .get(...publicView, categoryController.findAll.bind(categoryController))
  .post(
    ...requirePermission("masters.edit"),
    categoryController.create.bind(categoryController)
  );
router
  .route("/:id")
  .get(...publicView, categoryController.findOne.bind(categoryController))
  .put(
    ...requirePermission("masters.edit"),
    categoryController.update.bind(categoryController)
  );
router
  .route("/:id/active/")
  .delete(
    ...requirePermission("masters.edit"),
    categoryController.deactivate.bind(categoryController)
  )
  .put(
    ...requirePermission("masters.edit"),
    categoryController.activate.bind(categoryController)
  );

export default router;
