import express from "express";
import { CategoryController } from "../controllers/category.controller.js";
import { isAuthenticated, requirePermission } from "../middleware/auth.middleware.js";
const router = express.Router();

const categoryController = new CategoryController();

const manageMasters = [isAuthenticated, requirePermission("masters.edit")];

router
  .route("/")
  .get(categoryController.findAll.bind(categoryController))
  .post(
    ...manageMasters,
    categoryController.create.bind(categoryController)
  );
router
  .route("/:id")
  .get(categoryController.findOne.bind(categoryController))
  .put(
    ...manageMasters,
    categoryController.update.bind(categoryController)
  );
router
  .route("/:id/active/")
  .delete(
    ...manageMasters,
    categoryController.deactivate.bind(categoryController)
  )
  .put(
    ...manageMasters,
    categoryController.activate.bind(categoryController)
  );

export default router;
