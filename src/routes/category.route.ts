import express from "express";
import { CategoryController } from "../controllers/category.controller.js";
import { attachRoles, optionalSession, requirePermission } from "../middleware/auth.middleware.js";
import { hideCostForPublic, hideProductsForPublic } from "../middleware/publicView.js";

// Sin sesión de staff no se exponen proveedores ni costos de los productos incluidos.
const publicView = [optionalSession, attachRoles, hideCostForPublic, hideProductsForPublic];
const router = express.Router();

const categoryController = new CategoryController();

const manageMasters = requirePermission("masters.edit");

router
  .route("/")
  .get(...publicView, categoryController.findAll.bind(categoryController))
  .post(
    ...manageMasters,
    categoryController.create.bind(categoryController),
  );
router
  .route("/:id")
  .get(...publicView, categoryController.findOne.bind(categoryController))
  .put(
    ...manageMasters,
    categoryController.update.bind(categoryController),
  );
router
  .route("/:id/active/")
  .delete(
    ...manageMasters,
    categoryController.deactivate.bind(categoryController),
  )
  .put(
    ...manageMasters,
    categoryController.activate.bind(categoryController)
  );

export default router;
