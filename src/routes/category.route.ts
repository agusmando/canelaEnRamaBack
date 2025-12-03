import express from "express";
import { CategoryController } from "../controllers/category.controller.ts";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.ts";
const router = express.Router();

const categoryController = new CategoryController();

const staff = ["Admin", "Employee"];

router
  .route("/")
  .get(categoryController.findAll.bind(categoryController))
  .post(
    isAuthenticated,
    requireRole(staff),
    categoryController.create.bind(categoryController)
  );
router
  .route("/:id")
  .get(categoryController.findOne.bind(categoryController))
  .put(
    isAuthenticated,
    requireRole(staff),
    categoryController.update.bind(categoryController)
  );
router
  .route("/:id/active/")
  .delete(
    isAuthenticated,
    requireRole(staff),
    categoryController.deactivate.bind(categoryController)
  )
  .put(
    isAuthenticated,
    requireRole(staff),
    categoryController.activate.bind(categoryController)
  );

export default router;
